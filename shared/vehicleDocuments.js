const vehicleDocumentMetadataPrefix = "Vehicle documents:";

function cleanDocumentMetadata(value = {}) {
  return {
    buildSheetPath: String(value.buildSheetPath || "").trim(),
    buildSheetName: String(value.buildSheetName || "").trim(),
    buildSheetType: String(value.buildSheetType || "").trim(),
  };
}

export function parseVehicleDocumentMetadata(notes) {
  const line = String(notes || "")
    .split("\n")
    .find((item) => item.trim().startsWith(vehicleDocumentMetadataPrefix));
  if (!line) return cleanDocumentMetadata();
  try {
    return cleanDocumentMetadata(JSON.parse(line.slice(vehicleDocumentMetadataPrefix.length).trim()));
  } catch {
    return cleanDocumentMetadata();
  }
}

export function stripVehicleDocumentMetadata(notes) {
  return String(notes || "")
    .split("\n")
    .filter((line) => !line.trim().startsWith(vehicleDocumentMetadataPrefix))
    .join("\n")
    .trim();
}

export function serializeVehicleDocumentMetadata(notes, metadata = {}) {
  const cleanNotes = stripVehicleDocumentMetadata(notes);
  const documents = cleanDocumentMetadata(metadata);
  if (!documents.buildSheetPath) return cleanNotes;
  return [cleanNotes, `${vehicleDocumentMetadataPrefix} ${JSON.stringify(documents)}`].filter(Boolean).join("\n");
}

export { vehicleDocumentMetadataPrefix };
