import test from "node:test";
import assert from "node:assert/strict";
import {
  isValidVin,
  mergeDecodedVehicleDetails,
  normalizeVin,
  vehicleDetailsFromVpic,
} from "../shared/vinDecoder.js";

test("normalizes and validates a standard 17-character VIN", () => {
  assert.equal(normalizeVin(" 1hgcm82633a004352 "), "1HGCM82633A004352");
  assert.equal(isValidVin("1HGCM82633A004352"), true);
  assert.equal(isValidVin("1HGCM82633I004352"), false);
});

test("maps public VIN decoder values to supported garage fields", () => {
  const vehicle = vehicleDetailsFromVpic({
    ModelYear: "2021",
    Make: "MERCEDES-BENZ",
    Model: "AMG GT",
    Trim: "63 S",
    BodyClass: "Coupe",
    DriveType: "AWD/All-Wheel Drive",
    TransmissionStyle: "Automatic",
    FuelTypePrimary: "Gasoline",
    DisplacementL: "4.0",
    EngineConfiguration: "V-Shaped",
    EngineCylinders: "8",
    EngineHP: "630",
  });
  assert.deepEqual(vehicle, {
    year: "2021",
    make: "Mercedes-Benz",
    model: "AMG GT",
    trim: "63 S",
    bodyStyle: "Coupe",
    drivetrain: "AWD",
    transmission: "Automatic",
    fuelType: "Gasoline",
    engine: "4L V-Shaped 8-cylinder",
    horsepower: "630",
  });
});

test("VIN autofill preserves information already entered by the member", () => {
  const result = mergeDecodedVehicleDetails(
    { year: "2022", make: "", model: "Custom model", trim: "" },
    { year: "2021", make: "Porsche", model: "911", trim: "Carrera" },
  );
  assert.equal(result.vehicle.year, "2022");
  assert.equal(result.vehicle.make, "Porsche");
  assert.equal(result.vehicle.model, "Custom model");
  assert.equal(result.vehicle.trim, "Carrera");
  assert.deepEqual(result.filled, ["make", "trim"]);
});
