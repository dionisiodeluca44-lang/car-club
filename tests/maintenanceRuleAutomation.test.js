import test from "node:test";
import assert from "node:assert/strict";
import {
  automationStatusForRule,
  normalizeDiscoveredRule,
  officialOwnerPortal,
  safeInspectionDraft,
  unresolvedAutomaticRule,
  verifiedRuleCanAutoActivate,
  vehicleRuleSignature,
} from "../shared/maintenanceRuleAutomation.js";

const vehicle = { year: 2019, make: "Mercedes-Benz", model: "AMG GT", trim: "S", engine: "4.0L V8" };

test("vehicle signatures are stable and official portals normalize aliases", () => {
  assert.equal(vehicleRuleSignature(vehicle), "2019-mercedes-benz-amg-gt-s-4-0l-v8");
  assert.match(officialOwnerPortal("Mercedes Benz"), /mercedes-benz\.ca/);
});

test("safe fallback never invents an interval", () => {
  const draft = safeInspectionDraft(vehicle);
  assert.equal(draft.mileageIntervalKm, null);
  assert.equal(draft.timeIntervalMonths, null);
  assert.equal(draft.requiresInspection, true);
  assert.equal(draft.automationStatus, "no_reliable_source");
});

test("discovered rules require an exact source and interval", () => {
  assert.equal(normalizeDiscoveredRule({ serviceType: "Oil service" }, vehicle), null);
  const rule = normalizeDiscoveredRule({
    ruleName: "Oil service schedule",
    serviceType: "Oil and filter service",
    serviceAliases: ["Oil change"],
    serviceCategory: "mechanical",
    mileageIntervalKm: 16000,
    timeIntervalMonths: 12,
    sourceTitle: "2019 Service Booklet",
    sourceUrl: "https://example.com/official.pdf",
    sourceVersion: "2019 edition",
    sourceCitation: "Maintenance section, page 12",
    confidenceLevel: "High",
    customerExplanation: "Follow the retained manufacturer schedule.",
  }, vehicle);
  assert.equal(rule.mileageIntervalKm, 16000);
  assert.equal(rule.vehicleApplicability.yearFrom, 2019);
  assert.equal(rule.sourceType, "manufacturer");
});

test("automation statuses remain review-first", () => {
  assert.equal(automationStatusForRule({ approval_status: "draft", source_type: "manufacturer", confidence_level: "High" }), "Ready to approve");
  assert.equal(automationStatusForRule({ approval_status: "draft", source_type: "internal_inspection", requires_inspection: true, source_reference: "No exact interval was confirmed" }), "No reliable source found");
  assert.equal(automationStatusForRule({ approval_status: "approved" }), "Approved");
});

test("unresolved automatic placeholders cannot be approved", () => {
  const draft = safeInspectionDraft(vehicle);
  assert.equal(unresolvedAutomaticRule({
    stable_key: draft.stableKey,
    requires_inspection: draft.requiresInspection,
    mileage_interval_km: draft.mileageIntervalKm,
    time_interval_months: draft.timeIntervalMonths,
    source_reference: draft.sourceReference,
  }), true);
  assert.equal(unresolvedAutomaticRule({ stable_key: "manual-rule", requires_inspection: true }), false);
});

test("only exact high-confidence manufacturer rules auto-activate", () => {
  const verified = {
    approval_status: "draft",
    source_type: "manufacturer",
    confidence_level: "High",
    source_version: "2019 Canadian owner booklet",
    source_reference: "Owner booklet — https://example.com/official.pdf — page 12",
    mileage_interval_km: 16000,
    time_interval_months: 12,
    requires_inspection: false,
    vehicle_applicability: { makes: ["Mercedes-Benz"], models: ["AMG GT"], yearFrom: 2019, yearTo: 2019 },
  };
  assert.equal(verifiedRuleCanAutoActivate(verified), true);
  assert.equal(verifiedRuleCanAutoActivate({ ...verified, confidence_level: "Medium" }), false);
  assert.equal(verifiedRuleCanAutoActivate({ ...verified, source_reference: "Unretained source" }), false);
  assert.equal(verifiedRuleCanAutoActivate({ ...verified, mileage_interval_km: null, time_interval_months: null }), false);
  assert.equal(verifiedRuleCanAutoActivate({ ...verified, requires_inspection: true }), false);
  assert.equal(verifiedRuleCanAutoActivate({ ...verified, vehicle_applicability: { makes: ["Mercedes-Benz"], models: ["AMG GT"] } }), false);
});
