import Foundation
import Capacitor
import HealthKit

/// Custom HealthKit bridge for Vector Football.
///
/// Reads recovery metrics (sleep, HRV, resting heart rate) to inform the
/// Daily Readiness check-in. READ-ONLY — the app never writes to Health.
///
/// Swift-only Capacitor plugin via `CAPBridgedPlugin`, so it works on the
/// app's Swift Package Manager setup without an Objective-C macro file and
/// without editing the CLI-managed Package.swift.
@objc(HealthKitPlugin)
public class HealthKitPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "HealthKitPlugin"
    public let jsName = "HealthKit"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestAuthorization", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "fetchRecovery", returnType: CAPPluginReturnPromise)
    ]

    private let healthStore = HKHealthStore()

    /// The (read-only) data types we ask the user to share.
    private func readTypes() -> Set<HKObjectType> {
        var types = Set<HKObjectType>()
        if let sleep = HKObjectType.categoryType(forIdentifier: .sleepAnalysis) { types.insert(sleep) }
        if let hrv = HKObjectType.quantityType(forIdentifier: .heartRateVariabilitySDNN) { types.insert(hrv) }
        if let rhr = HKObjectType.quantityType(forIdentifier: .restingHeartRate) { types.insert(rhr) }
        return types
    }

    private func asleepValues() -> Set<Int> {
        // Always include the legacy .asleep value. Third-party devices (Garmin, Fitbit,
        // Oura, etc.) write sleep to Health using the pre-iOS-16 .asleep category rather
        // than the stage-breakdown values, so without it their data is silently dropped.
        var values: Set<Int> = [HKCategoryValueSleepAnalysis.asleep.rawValue]
        if #available(iOS 16.0, *) {
            values.insert(HKCategoryValueSleepAnalysis.asleepCore.rawValue)
            values.insert(HKCategoryValueSleepAnalysis.asleepDeep.rawValue)
            values.insert(HKCategoryValueSleepAnalysis.asleepREM.rawValue)
            values.insert(HKCategoryValueSleepAnalysis.asleepUnspecified.rawValue)
        }
        return values
    }

    private func average(_ values: [Double]) -> Double? {
        guard !values.isEmpty else { return nil }
        return values.reduce(0, +) / Double(values.count)
    }

    private func dayBucket(_ date: Date) -> Date {
        Calendar.current.startOfDay(for: date)
    }

    @objc func isAvailable(_ call: CAPPluginCall) {
        call.resolve(["available": HKHealthStore.isHealthDataAvailable()])
    }

    @objc func requestAuthorization(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else {
            call.resolve(["granted": false])
            return
        }
        healthStore.requestAuthorization(toShare: nil, read: readTypes()) { success, error in
            if let error = error {
                call.reject("Health authorization failed: \(error.localizedDescription)")
                return
            }
            // Apple deliberately hides read-authorization status for privacy;
            // `success` only means the prompt completed without error.
            call.resolve(["granted": success])
        }
    }

    @objc func fetchRecovery(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else {
            call.resolve([
                "sleepHours": NSNull(),
                "hrvMs": NSNull(),
                "restingHr": NSNull(),
                "avgSleepHours": NSNull(),
                "avgHrvMs": NSNull(),
                "avgRestingHr": NSNull(),
                "sleepBaselineDays": 0,
                "hrvBaselineDays": 0,
                "restingHrBaselineDays": 0
            ])
            return
        }

        let group = DispatchGroup()
        var sleepHours: Double?
        var hrvMs: Double?
        var restingHr: Double?
        // 30-day baselines read straight from Apple Health (not in-app logs) so
        // days the athlete never opens the app can't skew their average.
        var avgSleepHours: Double?
        var avgHrvMs: Double?
        var avgRestingHr: Double?
        var sleepBaselineDays = 0
        var hrvBaselineDays = 0
        var restingHrBaselineDays = 0

        // --- Sleep: most recent night's "asleep" time ---
        // Look back 48h (not a strict 24h) so last night is still found when the
        // athlete checks in late evening, or when the watch syncs to Health with a
        // delay. We take the most recent sleep SESSION (samples ending within 18h of
        // the latest sample) and MERGE overlapping intervals, so a source that writes
        // both an aggregate "asleep" block and per-stage blocks isn't double-counted.
        if let sleepType = HKObjectType.categoryType(forIdentifier: .sleepAnalysis) {
            group.enter()
            let start = Calendar.current.date(byAdding: .hour, value: -48, to: Date())
            let predicate = HKQuery.predicateForSamples(withStart: start, end: Date(), options: [])
            let sort = [NSSortDescriptor(key: HKSampleSortIdentifierEndDate, ascending: false)]
            let query = HKSampleQuery(sampleType: sleepType, predicate: predicate,
                                      limit: HKObjectQueryNoLimit, sortDescriptors: sort) { _, samples, _ in
                let asleepValues = self.asleepValues()
                let asleep = (samples as? [HKCategorySample] ?? [])
                    .filter { asleepValues.contains($0.value) }
                if let latestEnd = asleep.first?.endDate {
                    // Keep only this sleep session: samples ending within 18h of waking.
                    let sessionStart = latestEnd.addingTimeInterval(-18 * 3600)
                    let intervals = asleep
                        .filter { $0.endDate > sessionStart }
                        .map { ($0.startDate, $0.endDate) }
                        .sorted { $0.0 < $1.0 }
                    // Merge overlaps so aggregate + per-stage samples don't double-count.
                    var merged: [(Date, Date)] = []
                    for iv in intervals {
                        if let last = merged.last, iv.0 <= last.1 {
                            merged[merged.count - 1].1 = max(last.1, iv.1)
                        } else {
                            merged.append(iv)
                        }
                    }
                    let seconds = merged.reduce(0.0) { $0 + $1.1.timeIntervalSince($1.0) }
                    if seconds > 0 { sleepHours = seconds / 3600.0 }
                }
                group.leave()
            }
            healthStore.execute(query)
        }

        // Recovery metrics must be RECENT — a sample from weeks ago must not drive
        // today's readiness. Bound HRV/RHR queries to the last 7 days; if there's
        // no recent sample we return null rather than a stale value.
        let recentStart = Calendar.current.date(byAdding: .day, value: -7, to: Date())
        let recentPredicate = HKQuery.predicateForSamples(withStart: recentStart, end: Date(), options: [])

        // --- HRV (SDNN): most recent sample in the last 7 days, in milliseconds ---
        if let hrvType = HKObjectType.quantityType(forIdentifier: .heartRateVariabilitySDNN) {
            group.enter()
            let sort = [NSSortDescriptor(key: HKSampleSortIdentifierEndDate, ascending: false)]
            let query = HKSampleQuery(sampleType: hrvType, predicate: recentPredicate, limit: 1, sortDescriptors: sort) { _, samples, _ in
                if let sample = samples?.first as? HKQuantitySample {
                    hrvMs = sample.quantity.doubleValue(for: HKUnit.secondUnit(with: .milli))
                }
                group.leave()
            }
            healthStore.execute(query)
        }

        // --- Resting heart rate: most recent sample in the last 7 days, in bpm ---
        if let rhrType = HKObjectType.quantityType(forIdentifier: .restingHeartRate) {
            group.enter()
            let sort = [NSSortDescriptor(key: HKSampleSortIdentifierEndDate, ascending: false)]
            let bpm = HKUnit.count().unitDivided(by: HKUnit.minute())
            let query = HKSampleQuery(sampleType: rhrType, predicate: recentPredicate, limit: 1, sortDescriptors: sort) { _, samples, _ in
                if let sample = samples?.first as? HKQuantitySample {
                    restingHr = sample.quantity.doubleValue(for: bpm)
                }
                group.leave()
            }
            healthStore.execute(query)
        }

        // --- 30-day baseline averages (for recovery algorithms) ---
        // The baseline excludes today and is averaged per distinct day, then across
        // days. This means five measured days really means five daily data points,
        // not five samples from one noisy day.
        let baselineEnd = Calendar.current.startOfDay(for: Date())
        let baselineStart = Calendar.current.date(byAdding: .day, value: -30, to: baselineEnd)
        let baselinePredicate = HKQuery.predicateForSamples(withStart: baselineStart, end: baselineEnd, options: [])

        if let sleepType = HKObjectType.categoryType(forIdentifier: .sleepAnalysis) {
            group.enter()
            let query = HKSampleQuery(sampleType: sleepType, predicate: baselinePredicate,
                                      limit: HKObjectQueryNoLimit, sortDescriptors: nil) { _, samples, _ in
                var secondsByDay: [Date: Double] = [:]
                if let samples = samples as? [HKCategorySample] {
                    let asleepValues = self.asleepValues()
                    for sample in samples where asleepValues.contains(sample.value) {
                        let day = self.dayBucket(sample.endDate)
                        secondsByDay[day, default: 0] += sample.endDate.timeIntervalSince(sample.startDate)
                    }
                }
                let dayHours = secondsByDay.values
                    .filter { $0 > 0 }
                    .map { $0 / 3600.0 }
                sleepBaselineDays = dayHours.count
                avgSleepHours = self.average(dayHours)
                group.leave()
            }
            healthStore.execute(query)
        }

        if let hrvType = HKObjectType.quantityType(forIdentifier: .heartRateVariabilitySDNN) {
            group.enter()
            let query = HKSampleQuery(sampleType: hrvType, predicate: baselinePredicate,
                                      limit: HKObjectQueryNoLimit, sortDescriptors: nil) { _, samples, _ in
                var valuesByDay: [Date: [Double]] = [:]
                if let samples = samples as? [HKQuantitySample] {
                    for sample in samples {
                        let day = self.dayBucket(sample.endDate)
                        valuesByDay[day, default: []].append(sample.quantity.doubleValue(for: HKUnit.secondUnit(with: .milli)))
                    }
                }
                let dayAverages = valuesByDay.values.compactMap { self.average($0) }
                hrvBaselineDays = dayAverages.count
                avgHrvMs = self.average(dayAverages)
                group.leave()
            }
            healthStore.execute(query)
        }

        if let rhrType = HKObjectType.quantityType(forIdentifier: .restingHeartRate) {
            group.enter()
            let bpm = HKUnit.count().unitDivided(by: HKUnit.minute())
            let query = HKSampleQuery(sampleType: rhrType, predicate: baselinePredicate,
                                      limit: HKObjectQueryNoLimit, sortDescriptors: nil) { _, samples, _ in
                var valuesByDay: [Date: [Double]] = [:]
                if let samples = samples as? [HKQuantitySample] {
                    for sample in samples {
                        let day = self.dayBucket(sample.endDate)
                        valuesByDay[day, default: []].append(sample.quantity.doubleValue(for: bpm))
                    }
                }
                let dayAverages = valuesByDay.values.compactMap { self.average($0) }
                restingHrBaselineDays = dayAverages.count
                avgRestingHr = self.average(dayAverages)
                group.leave()
            }
            healthStore.execute(query)
        }

        group.notify(queue: .main) {
            call.resolve([
                "sleepHours": sleepHours ?? NSNull(),
                "hrvMs": hrvMs ?? NSNull(),
                "restingHr": restingHr ?? NSNull(),
                "avgSleepHours": avgSleepHours ?? NSNull(),
                "avgHrvMs": avgHrvMs ?? NSNull(),
                "avgRestingHr": avgRestingHr ?? NSNull(),
                "sleepBaselineDays": sleepBaselineDays,
                "hrvBaselineDays": hrvBaselineDays,
                "restingHrBaselineDays": restingHrBaselineDays
            ])
        }
    }
}
