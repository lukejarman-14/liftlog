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
            call.resolve(["sleepHours": NSNull(), "hrvMs": NSNull(), "restingHr": NSNull()])
            return
        }

        let group = DispatchGroup()
        var sleepHours: Double?
        var hrvMs: Double?
        var restingHr: Double?

        // --- Sleep: sum "asleep" minutes over the last 24h ---
        if let sleepType = HKObjectType.categoryType(forIdentifier: .sleepAnalysis) {
            group.enter()
            let start = Calendar.current.date(byAdding: .hour, value: -24, to: Date())
            let predicate = HKQuery.predicateForSamples(withStart: start, end: Date(), options: [])
            let query = HKSampleQuery(sampleType: sleepType, predicate: predicate,
                                      limit: HKObjectQueryNoLimit, sortDescriptors: nil) { _, samples, _ in
                var seconds: Double = 0
                if let samples = samples as? [HKCategorySample] {
                    // iOS 16+ splits asleep into core/deep/REM; older iOS uses a single value.
                    var asleepValues: Set<Int> = [HKCategoryValueSleepAnalysis.asleep.rawValue]
                    if #available(iOS 16.0, *) {
                        asleepValues = [
                            HKCategoryValueSleepAnalysis.asleepCore.rawValue,
                            HKCategoryValueSleepAnalysis.asleepDeep.rawValue,
                            HKCategoryValueSleepAnalysis.asleepREM.rawValue,
                            HKCategoryValueSleepAnalysis.asleepUnspecified.rawValue
                        ]
                    }
                    for sample in samples where asleepValues.contains(sample.value) {
                        seconds += sample.endDate.timeIntervalSince(sample.startDate)
                    }
                }
                if seconds > 0 { sleepHours = seconds / 3600.0 }
                group.leave()
            }
            healthStore.execute(query)
        }

        // --- HRV (SDNN): most recent sample, in milliseconds ---
        if let hrvType = HKObjectType.quantityType(forIdentifier: .heartRateVariabilitySDNN) {
            group.enter()
            let sort = [NSSortDescriptor(key: HKSampleSortIdentifierEndDate, ascending: false)]
            let query = HKSampleQuery(sampleType: hrvType, predicate: nil, limit: 1, sortDescriptors: sort) { _, samples, _ in
                if let sample = samples?.first as? HKQuantitySample {
                    hrvMs = sample.quantity.doubleValue(for: HKUnit.secondUnit(with: .milli))
                }
                group.leave()
            }
            healthStore.execute(query)
        }

        // --- Resting heart rate: most recent sample, in bpm ---
        if let rhrType = HKObjectType.quantityType(forIdentifier: .restingHeartRate) {
            group.enter()
            let sort = [NSSortDescriptor(key: HKSampleSortIdentifierEndDate, ascending: false)]
            let bpm = HKUnit.count().unitDivided(by: HKUnit.minute())
            let query = HKSampleQuery(sampleType: rhrType, predicate: nil, limit: 1, sortDescriptors: sort) { _, samples, _ in
                if let sample = samples?.first as? HKQuantitySample {
                    restingHr = sample.quantity.doubleValue(for: bpm)
                }
                group.leave()
            }
            healthStore.execute(query)
        }

        group.notify(queue: .main) {
            call.resolve([
                "sleepHours": sleepHours ?? NSNull(),
                "hrvMs": hrvMs ?? NSNull(),
                "restingHr": restingHr ?? NSNull()
            ])
        }
    }
}
