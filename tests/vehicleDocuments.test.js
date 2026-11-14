import test from "node:test";
import assert from "node:assert/strict";
import {
  parseVehicleDocumentMetadata,
  serializeVehicleDocumentMetadata,
  stripVehicleDocumentMetadata,
} from "../shared/vehicleDocuments.js";

test("stores build-sheet metadata without changing member notes", () => {
  const notes = serializeVehicleDocumentMetadata("Kept indoors", {
    buildSheetPath: "member/build-sheets/file.pdf",
    buildSheetName: "Factory build sheet.pdf",
    buildSheetType: "application/pdf",
  });
  assert.equal(stripVehicleDocumentMetadata(notes), "Kept indoors");
  assert.deepEqual(parseVehicleDocumentMetadata(notes), {
    buildSheetPath: "member/build-sheets/file.pdf",
    buildSheetName: "Factory build sheet.pdf",
    buildSheetType: "application/pdf",
  });
});

test("malformed metadata is ignored safely", () => {
  assert.deepEqual(parseVehicleDocumentMetadata("Vehicle documents: not-json"), {
    buildSheetPath: "",
    buildSheetName: "",
    buildSheetType: "",
  });
});
