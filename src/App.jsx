import React, { Component, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  CalendarCheck,
  Car,
  Check,
  ChevronRight,
  ClipboardCheck,
  Clock,
  CreditCard,
  Gauge,
  Home,
  KeyRound,
  LogOut,
  MapPin,
  Menu,
  Plus,
  ShieldCheck,
  Sparkles,
  Upload,
  User,
  Warehouse,
  Wrench,
  X,
} from "lucide-react";
import {
  createAccount,
  createFeedPost,
  createServiceRequest,
  createVehicle,
  deleteVehicleRecord,
  getCurrentMember,
  isBackendConfigured,
  loadFeedPosts,
  loadServiceRequests,
  loadVehicles,
  resendConfirmationEmail,
  signIn,
  signOut,
  subscribeToFeedPosts,
  updateMemberPassword,
  updateMemberProfile,
  updateVehicleRecord,
} from "./lib/backend";

const services = [
  {
    icon: ClipboardCheck,
    title: "Collection Management",
    items: ["Mileage checks", "Battery care", "Insurance tracking", "Storage oversight", "Monthly condition reports"],
  },
  {
    icon: Wrench,
    title: "Maintenance Concierge",
    items: ["Oil changes", "Tires", "Brakes", "Diagnostics", "Warranty work"],
  },
  {
    icon: Gauge,
    title: "Modification & Tuning",
    items: ["Performance tuning", "Exhaust", "Wheels", "Suspension", "Track prep"],
  },
  {
    icon: Sparkles,
    title: "Cosmetic Services",
    items: ["Detailing", "Ceramic coating", "Paint correction", "Paint protection film", "Window tint"],
  },
  {
    icon: KeyRound,
    title: "Transportation",
    items: ["Vehicle pickup", "Service transport", "Airport pickup", "Return delivery", "Nationwide shipping"],
  },
  {
    icon: Gauge,
    title: "Buying Concierge",
    items: ["Vehicle search", "Inspections", "Negotiation", "Shipping", "Delivery coordination"],
  },
  {
    icon: Warehouse,
    title: "Storage & Luxury Care",
    items: ["Climate-controlled storage", "Weekly exercise", "Battery tender", "Concierge fueling", "Show prep"],
  },
  {
    icon: ShieldCheck,
    title: "Emergency & Roadside",
    items: ["Flat tire help", "Dead battery", "Tow coordination", "Lockout support", "Accident support"],
  },
  {
    icon: Car,
    title: "Selling Concierge",
    items: ["Photography", "Listing support", "Buyer screening", "Negotiation", "Paperwork coordination"],
  },
  {
    icon: ClipboardCheck,
    title: "Fleet Management",
    items: ["5 to 100 vehicles", "Preventive schedules", "Driver coordination", "Service records", "Vendor management"],
  },
];

const plans = [
  {
    name: "Silver",
    price: "$99",
    cadence: "/month",
    intro: "For owners who want the essentials managed with priority support.",
    features: ["Service reminders", "Priority booking", "Basic vehicle health report", "Annual detail credit", "Digital vehicle records"],
  },
  {
    name: "Club Drive",
    price: "$149",
    cadence: "/month",
    intro: "For owners who want pickup, delivery, and regular care coordination handled.",
    features: ["Everything in Silver", "Pickup and delivery coordination", "Monthly vehicle check-in", "Wash and care scheduling", "Priority service updates"],
  },
  {
    name: "Gold",
    price: "$199",
    cadence: "/month",
    intro: "For daily drivers and seasonal vehicles that need consistent care.",
    featured: true,
    features: ["Everything in Silver", "Quarterly detail", "Seasonal tire coordination", "Oil change coordination", "Brake and battery inspection"],
  },
  {
    name: "Platinum",
    price: "$399",
    cadence: "/month",
    intro: "For owners who want complete white-glove vehicle management.",
    features: ["Everything in Gold", "Monthly vehicle care", "Full maintenance concierge", "Emergency coordination", "Premium care coordination"],
  },
  {
    name: "Collector",
    price: "Custom",
    cadence: "",
    intro: "For multi-car owners, collectors, and specialty storage needs.",
    features: ["Dedicated account manager", "Full collection management", "Storage coordination", "Monthly inspections", "Market value tracking"],
  },
];

const serviceOptions = [
  {
    label: "Schedule maintenance",
    allowedPlans: ["Silver", "Club Drive", "Gold", "Platinum", "Collector"],
  },
  {
    label: "Oil change",
    allowedPlans: ["Silver", "Club Drive", "Gold", "Platinum", "Collector"],
  },
  {
    label: "Tires",
    allowedPlans: ["Silver", "Club Drive", "Gold", "Platinum", "Collector"],
  },
  {
    label: "Brakes",
    allowedPlans: ["Silver", "Club Drive", "Gold", "Platinum", "Collector"],
  },
  {
    label: "Diagnostics",
    allowedPlans: ["Silver", "Club Drive", "Gold", "Platinum", "Collector"],
  },
  {
    label: "Battery service",
    allowedPlans: ["Silver", "Club Drive", "Gold", "Platinum", "Collector"],
  },
  {
    label: "Recall or warranty work",
    allowedPlans: ["Silver", "Club Drive", "Gold", "Platinum", "Collector"],
  },
  {
    label: "Detail my car",
    allowedPlans: ["Silver", "Club Drive", "Gold", "Platinum", "Collector"],
  },
  {
    label: "Ceramic coating",
    allowedPlans: ["Club Drive", "Gold", "Platinum", "Collector"],
  },
  {
    label: "Paint protection film",
    allowedPlans: ["Club Drive", "Gold", "Platinum", "Collector"],
  },
  {
    label: "Window tint",
    allowedPlans: ["Club Drive", "Gold", "Platinum", "Collector"],
  },
  {
    label: "Rim or windshield repair",
    allowedPlans: ["Club Drive", "Gold", "Platinum", "Collector"],
  },
  {
    label: "Need repairs",
    allowedPlans: ["Silver", "Club Drive", "Gold", "Platinum", "Collector"],
  },
  {
    label: "Vehicle offer request",
    allowedPlans: ["Silver", "Club Drive", "Gold", "Platinum", "Collector"],
  },
  {
    label: "Pickup and delivery",
    allowedPlans: ["Club Drive", "Gold", "Platinum", "Collector"],
  },
  {
    label: "Tire change / storage",
    allowedPlans: ["Gold", "Platinum", "Collector"],
  },
  {
    label: "Tuning / modifications",
    allowedPlans: ["Platinum", "Collector"],
  },
  {
    label: "Vehicle storage",
    allowedPlans: ["Platinum", "Collector"],
  },
  {
    label: "Emergency concierge",
    allowedPlans: ["Platinum", "Collector"],
  },
  {
    label: "Roadside assistance",
    allowedPlans: ["Platinum", "Collector"],
  },
  {
    label: "Buy a vehicle",
    allowedPlans: ["Platinum", "Collector"],
  },
  {
    label: "Sell my vehicle",
    allowedPlans: ["Platinum", "Collector"],
  },
  {
    label: "Insurance help",
    allowedPlans: ["Platinum", "Collector"],
  },
  {
    label: "Registration renewal",
    allowedPlans: ["Platinum", "Collector"],
  },
  {
    label: "Documents and paperwork",
    allowedPlans: ["Platinum", "Collector"],
  },
  {
    label: "Collection management",
    allowedPlans: ["Collector"],
  },
  {
    label: "Fleet management",
    allowedPlans: ["Collector"],
  },
];

const servicePaymentRules = {
  "Oil change": {
    amount: "Full amount when price is confirmed",
    mode: "full",
    note: "Best for a known service with a clear shop quote.",
    title: "Pay in full",
  },
  "Battery service": {
    amount: "Full amount when price is confirmed",
    mode: "full",
    note: "Used when the battery, labor, and provider quote are clear.",
    title: "Pay in full",
  },
  "Detail my car": {
    amount: "Full amount when package is selected",
    mode: "full",
    note: "Used for standard wash, detail, and care packages with known pricing.",
    title: "Pay in full",
  },
  "Window tint": {
    amount: "Full amount when film and vehicle are confirmed",
    mode: "full",
    note: "Used when the tint package and vehicle details create a firm quote.",
    title: "Pay in full",
  },
  "Pickup and delivery": {
    amount: "Full amount when route is confirmed",
    mode: "full",
    note: "Used when pickup, delivery, and distance are known.",
    title: "Pay in full",
  },
  "Registration renewal": {
    amount: "Full amount when fees are confirmed",
    mode: "full",
    note: "Used when government fees and concierge handling are known.",
    title: "Pay in full",
  },
  "Documents and paperwork": {
    amount: "Full amount when scope is confirmed",
    mode: "full",
    note: "Used when the paperwork request is clear and fixed.",
    title: "Pay in full",
  },
};

const defaultDepositTerms = {
  amount: "Security deposit before coordination starts",
  mode: "deposit",
  note: "Used when White Glove needs to inspect, diagnose, quote, compare providers, or confirm the exact scope before final pricing.",
  title: "Security deposit",
};

const bookingServiceCatalog = {
  "Detail my car": {
    category: "Appearance",
    options: [
      { name: "Maintenance Wash", prices: { car: 70, suv: 100, truck: 100, van: 100 } },
      { name: "Full Detailing", prices: { car: 150, suv: 200, truck: 250, van: 250 } },
      { name: "Custom / Not Sure", deposit: 100 },
    ],
    questions: ["Interior, exterior, or both", "Condition: light, moderate, or heavy", "Pet hair, odour, stains, or special photos"],
  },
  Brakes: {
    category: "Maintenance & Repair",
    deposit: 100,
    options: ["Brake Pads", "Brake Discs / Rotors", "Pads and Discs / Rotors", "Brake Inspection", "Not Sure What I Need"],
    questions: ["Front, rear, or not sure", "Grinding, squeaking, vibration, warning light, or reduced braking"],
  },
  "Oil change": {
    category: "Maintenance & Repair",
    deposit: 50,
    options: ["Conventional Oil", "Synthetic Blend", "Full Synthetic", "Diesel Oil Change", "Not Sure"],
    questions: ["Current mileage update", "Warning or maintenance message", "Filter or extra service notes"],
  },
  Tires: {
    category: "Tires & Wheels",
    deposit: 75,
    options: ["Seasonal Change - Tires on Rims", "Seasonal Change - Tires off Rims", "Mount and Balance", "Flat Tire Repair", "Buy New Tires", "Tire Storage", "Not Sure"],
    questions: ["Tire size if known", "Quantity", "On rims or off rims", "Need storage"],
  },
  Diagnostics: {
    category: "Maintenance & Repair",
    deposit: 100,
    options: ["Warning Light", "Noise or Vibration", "No-Start / Starting Issue", "Performance Issue", "Electrical Issue", "General Inspection", "Not Sure"],
  },
  "Battery service": {
    category: "Maintenance & Repair",
    deposit: 75,
    options: ["Battery Test", "Battery Replacement", "Boost / Jump Start", "Charging System Check", "Not Sure"],
  },
  "Recall or warranty work": {
    category: "Concierge",
    deposit: 75,
    options: ["Check for Open Recalls", "Book Dealer Appointment", "Vehicle Drop-off and Pick-up", "Warranty Claim Assistance", "Not Sure"],
  },
  "Ceramic coating": {
    category: "Protection",
    deposit: 200,
    options: ["Ceramic Coating"],
    basePrices: { car: 800, suv: 900, truck: 900, van: 900 },
    note: "Base price. Paint correction or extra preparation may increase the final price.",
  },
  "Paint protection film": {
    category: "Protection",
    deposit: 250,
    options: ["Partial Front", "Full Front", "Rocker Panels", "Door Cups / Door Edges", "Full Vehicle", "Custom / Not Sure"],
  },
  "Window tint": {
    category: "Appearance",
    deposit: 100,
    options: ["Front Two Windows", "Rear Section", "Full Vehicle", "Windshield Sun Strip", "Remove and Replace Existing Tint", "Custom / Not Sure"],
  },
  "Rim or windshield repair": {
    category: "Repair",
    deposit: 100,
    options: ["Cosmetic Rim Repair", "Bent Rim Repair", "Cracked Rim Repair", "Windshield Chip Repair", "Windshield Crack / Replacement", "Not Sure"],
  },
  "Need repairs": {
    category: "Maintenance & Repair",
    deposit: 100,
    options: ["Engine", "Transmission", "Suspension / Steering", "Exhaust", "Electrical", "Heating / A/C", "Body Repair", "Not Sure"],
  },
  "Pickup and delivery": {
    category: "Transport",
    options: [
      { name: "Montreal Island", price: 175 },
      { name: "Outside Montreal Island - Nearby", displayPrice: "From $225 CAD" },
      { name: "Outside Montreal Island - Extended Distance", displayPrice: "From $250 CAD" },
      { name: "Custom Distance / Not Sure", deposit: 100 },
    ],
  },
  "Vehicle offer request": {
    category: "Buying & Selling",
    options: [{ name: "Sell My Vehicle", price: 0 }, { name: "Trade-In Appraisal", price: 0 }, { name: "Market Value Estimate", price: 0 }],
  },
  "Buy a vehicle": {
    category: "Buying & Selling",
    deposit: 250,
    options: ["Find a Specific Vehicle", "Help Me Choose", "Pre-Purchase Inspection", "Negotiation Assistance", "Full Buying Concierge"],
  },
  "Sell my vehicle": {
    category: "Buying & Selling",
    options: [{ name: "Request an Offer", price: 0 }, { name: "Consignment / Sell It for Me", deposit: 250 }, { name: "Listing and Advertising Help", deposit: 100 }, { name: "Full Selling Concierge", deposit: 250 }],
  },
  "Insurance help": {
    category: "Administration",
    deposit: 75,
    options: ["New Policy Assistance", "Insurance Claim Assistance", "Document Help", "Not Sure"],
  },
  "Registration renewal": {
    category: "Administration",
    deposit: 75,
    options: ["Registration Renewal", "Ownership Transfer", "Plate / Permit Help", "Not Sure"],
    note: "Government fees are separate and charged at cost.",
  },
  "Vehicle storage": {
    category: "Storage",
    deposit: 150,
    options: ["Indoor Storage", "Outdoor Storage", "Short-Term Storage", "Seasonal Storage", "Long-Term Storage"],
  },
  "Tuning / modifications": {
    category: "Customization",
    deposit: 150,
    options: ["Performance Upgrade", "Suspension / Lowering", "Wheels / Fitment", "Exhaust Upgrade", "Lighting / Electronics", "Custom / Not Sure"],
  },
  "Emergency concierge": {
    category: "Emergency",
    deposit: 150,
    options: ["Vehicle Stranded", "Accident Assistance", "Urgent Repair Coordination", "Urgent Vehicle Transport", "Other Emergency"],
  },
  "Roadside assistance": {
    category: "Emergency",
    deposit: 100,
    options: ["Battery Boost", "Flat Tire", "Lockout", "Fuel Delivery", "Tow", "Not Sure"],
  },
};

function serviceCatalogForLabel(serviceLabel) {
  if (serviceLabel === "Tire change / storage") return bookingServiceCatalog.Tires;
  if (serviceLabel === "Documents and paperwork") return bookingServiceCatalog["Insurance help"];
  if (serviceLabel === "Collection management") return { category: "Collection", deposit: 250, options: ["Monthly Collection Review", "Storage Oversight", "Condition Report", "Full Collection Management"] };
  if (serviceLabel === "Fleet management") return { category: "Fleet", deposit: 250, options: ["Fleet Review", "Preventive Schedule", "Vendor Coordination", "Full Fleet Management"] };
  if (serviceLabel === "Schedule maintenance") return { category: "Maintenance & Repair", deposit: 75, options: ["Recommended Service", "Preventive Maintenance", "Not Sure"] };
  return bookingServiceCatalog[serviceLabel] || null;
}

function serviceOptionsForBooking(serviceLabel) {
  const catalog = serviceCatalogForLabel(serviceLabel);
  if (!catalog?.options?.length) return ["Not Sure"];
  return catalog.options.map((option) => (typeof option === "string" ? option : option.name));
}

function serviceQuestionsForBooking(serviceLabel) {
  return serviceCatalogForLabel(serviceLabel)?.questions || [];
}

function formatCad(amount) {
  return `$${amount} CAD`;
}

function vehicleClassFromVehicle(vehicle = {}) {
  const combined = `${vehicle.vehicleType || ""} ${vehicle.type || ""} ${vehicle.use || ""} ${vehicle.model || ""}`.toLowerCase();
  if (/truck|pickup|f-150|silverado|ram|sierra|tacoma|tundra/.test(combined)) return "truck";
  if (/van|minivan|sprinter|sienna|odyssey|caravan/.test(combined)) return "van";
  if (/suv|crossover|x5|x3|gle|glc|range rover|cayenne|macan|urus|q5|q7|rav4|cr-v|highlander|escalade|yukon|tahoe/.test(combined)) return "suv";
  return "car";
}

function paymentTermsForService(serviceLabel, vehicle, selectedOptionName) {
  const catalog = serviceCatalogForLabel(serviceLabel);
  const vehicleClass = vehicleClassFromVehicle(vehicle);
  const selectedOption = catalog?.options?.find((option) => (typeof option === "string" ? option : option.name) === selectedOptionName);
  const option = typeof selectedOption === "string" ? {} : selectedOption || {};

  if (option.price === 0) {
    return {
      amount: "Free request",
      mode: "free",
      note: "White Glove will review the request and follow up with next steps.",
      title: "No payment due now",
    };
  }

  if (option.prices?.[vehicleClass]) {
    return {
      amount: `${formatCad(option.prices[vehicleClass])} plus taxes at checkout`,
      mode: "full",
      note: "This service has fixed pricing based on the selected Garage vehicle.",
      title: "Pay in full",
    };
  }

  if (option.price) {
    return {
      amount: `${formatCad(option.price)} plus taxes at checkout`,
      mode: "full",
      note: "This service has a clear fixed price for the selected option.",
      title: "Pay in full",
    };
  }

  if (option.displayPrice) {
    return {
      amount: `${option.displayPrice} plus taxes at checkout`,
      mode: "full",
      note: "Final price is based on distance and logistics confirmation.",
      title: "Starting price",
    };
  }

  if (catalog?.basePrices?.[vehicleClass]) {
    return {
      amount: `${formatCad(catalog.deposit || 100)} deposit today. Estimated base price: ${formatCad(catalog.basePrices[vehicleClass])} plus taxes`,
      mode: "deposit",
      note: catalog.note || "The deposit is applied to the final invoice after the vehicle is reviewed.",
      title: "Security deposit",
    };
  }

  const depositAmount = option.deposit || option.deposit_amount || catalog?.deposit;
  if (depositAmount) {
    return {
      amount: `${formatCad(depositAmount)} deposit today`,
      mode: "deposit",
      note: catalog?.note || "Final price will be confirmed after reviewing the vehicle and requested work. Your deposit is applied to the final invoice.",
      title: "Security deposit",
    };
  }

  return servicePaymentRules[serviceLabel] || defaultDepositTerms;
}

function paymentMethodLabel(method) {
  if (method === "new-card") return "New credit card";
  if (method === "apple-pay") return "Apple Pay";
  return "Card on file";
}

function paymentAmountCents(paymentTerms) {
  if (Number.isFinite(paymentTerms?.amountCents)) return paymentTerms.amountCents;
  const match = String(paymentTerms?.amount || "").match(/\$([\d,]+(?:\.\d{2})?)/);
  if (!match) return 0;
  return Math.round(Number(match[1].replace(/,/g, "")) * 100);
}

let googlePlacesScriptPromise = null;

function loadGooglePlacesScript(apiKey) {
  if (!apiKey) return Promise.reject(new Error("Missing Google Maps API key"));
  if (window.google?.maps?.places) return Promise.resolve(window.google);
  if (googlePlacesScriptPromise) return googlePlacesScriptPromise;

  googlePlacesScriptPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector("script[data-google-places='true']");

    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(window.google));
      existingScript.addEventListener("error", reject);
      return;
    }

    const script = document.createElement("script");
    script.async = true;
    script.defer = true;
    script.dataset.googlePlaces = "true";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places`;
    script.onload = () => resolve(window.google);
    script.onerror = reject;
    document.head.appendChild(script);
  });

  return googlePlacesScriptPromise;
}

function AddressAutocomplete({ label, name, onChange, placeholder, required, value }) {
  const inputRef = useRef(null);
  const [placesReady, setPlacesReady] = useState(false);
  const [placesError, setPlacesError] = useState(false);
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  useEffect(() => {
    if (!apiKey || !inputRef.current) return undefined;

    let autocomplete;
    let listener;
    let mounted = true;

    loadGooglePlacesScript(apiKey)
      .then((google) => {
        if (!mounted || !inputRef.current) return;
        autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
          componentRestrictions: { country: ["ca", "us"] },
          fields: ["formatted_address", "geometry", "name"],
          types: ["geocode", "establishment"],
        });
        listener = autocomplete.addListener("place_changed", () => {
          const place = autocomplete.getPlace();
          onChange(place.formatted_address || inputRef.current.value);
        });
        setPlacesReady(true);
      })
      .catch(() => {
        if (mounted) setPlacesError(true);
      });

    return () => {
      mounted = false;
      if (listener?.remove) listener.remove();
      if (autocomplete && window.google?.maps?.event) {
        window.google.maps.event.clearInstanceListeners(autocomplete);
      }
    };
  }, [apiKey, onChange]);

  return (
    <label className="address-autocomplete-field">
      {label}
      <input
        ref={inputRef}
        autoComplete="street-address"
        name={name}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        type="text"
        value={value}
      />
      <small>
        {apiKey
          ? placesReady
            ? "Start typing and choose the matching address."
            : placesError
              ? "Address suggestions are unavailable right now. You can still type the address."
              : "Loading address suggestions..."
          : "Type the full address. Add a Google Maps API key to turn on live address suggestions."}
      </small>
    </label>
  );
}

const transportChoices = [
  {
    amountCents: 0,
    description: "You will bring the vehicle to the provider yourself.",
    direction: "self-dropoff",
    label: "I will drive / drop off",
    value: "self-dropoff",
  },
  {
    amountCents: 9500,
    description: "White Glove schedules pickup to the provider.",
    direction: "one-way",
    label: "Schedule pickup",
    value: "pickup-one-way",
  },
  {
    amountCents: 17500,
    description: "White Glove schedules pickup and return after service.",
    direction: "two-way",
    label: "Pickup and return",
    value: "pickup-two-way",
  },
];

const warrantyChoices = [
  { label: "Not a warranty request", value: "not-warranty" },
  { label: "Factory warranty", value: "factory-warranty" },
  { label: "Extended warranty", value: "extended-warranty" },
  { label: "Not sure, please check", value: "check-warranty" },
];

function bookingPaymentTerms(baseTerms, transportChoice, warrantyCoverage) {
  const transport = transportChoice || transportChoices[0];
  const transportCents = transport.amountCents || 0;
  const warrantySelected = warrantyCoverage && warrantyCoverage !== "not-warranty";
  const baseCents = warrantySelected ? 0 : paymentAmountCents(baseTerms);
  const totalCents = baseCents + transportCents;
  const warrantyLabel = warrantyChoices.find((choice) => choice.value === warrantyCoverage)?.label || "Not a warranty request";
  const transportLabel = transport.amountCents > 0 ? `${transport.label} (${formatCad(transport.amountCents / 100)})` : transport.label;

  if (warrantySelected) {
    return {
      amount: totalCents > 0 ? `${formatCad(totalCents / 100)} transportation charge today` : "Free warranty request",
      amountCents: totalCents,
      mode: totalCents > 0 ? "transport" : "free",
      note: totalCents > 0
        ? `Warranty-covered work has no service charge today. This covers ${transportLabel}.`
        : "Warranty-covered work has no service charge today. White Glove will coordinate with the dealership or provider.",
      title: totalCents > 0 ? "Transportation charge" : "Warranty request",
      transportAmount: transportCents > 0 ? formatCad(transportCents / 100) : "No transport charge",
      transportDirection: transport.direction,
      transportLabel,
      warrantyCoverage,
      warrantyLabel,
    };
  }

  if (transportCents > 0) {
    return {
      amount: `${formatCad(totalCents / 100)} today`,
      amountCents: totalCents,
      mode: baseTerms.mode === "free" ? "transport" : baseTerms.mode,
      note: `${baseTerms.note} Transportation added: ${transportLabel}.`,
      title: baseTerms.mode === "free" ? "Transportation charge" : baseTerms.title,
      transportAmount: formatCad(transportCents / 100),
      transportDirection: transport.direction,
      transportLabel,
      warrantyCoverage,
      warrantyLabel,
    };
  }

  return {
    ...baseTerms,
    amountCents: paymentAmountCents(baseTerms),
    transportAmount: "No transport charge",
    transportDirection: transport.direction,
    transportLabel,
    warrantyCoverage,
    warrantyLabel,
  };
}

function vehicleLabel(vehicle = {}) {
  return `${vehicle.year || ""} ${vehicle.make || ""} ${vehicle.model || ""}`.trim() || "Garage vehicle";
}

function vehicleMeta(vehicle = {}) {
  return [vehicle.color, vehicle.plate, vehicle.nickname].filter(Boolean).join(" • ") || "Garage vehicle";
}

function getAvailableServices(plan) {
  return serviceOptions.filter((service) => service.allowedPlans.includes(plan));
}

function canBookService(plan, serviceLabel) {
  return getAvailableServices(plan).some((service) => service.label === serviceLabel);
}

function hasCollectionPackage(plan) {
  return plan === "Collector";
}

function garageVehicleLimit(plan) {
  return hasCollectionPackage(plan) ? Infinity : 1;
}

function canAddGarageVehicle(plan, garageCount) {
  return garageCount < garageVehicleLimit(plan);
}

function garageLimitLabel(plan) {
  return hasCollectionPackage(plan) ? "Unlimited vehicles" : "1 vehicle";
}

const defaultNotificationSettings = {
  bookingUpdates: true,
  feedActivity: true,
  offers: true,
  serviceReminders: true,
};

const benefits = [
  "Save time",
  "Protect vehicle value",
  "Never miss maintenance",
  "One contact for everything",
  "One membership for every vehicle need",
  "Better records for resale",
  "No calling shops or comparing prices",
  "Built for daily drivers, collections, and fleets",
];

const reportItems = ["Photos", "Tire condition", "Brake condition", "Battery condition", "Fluid levels", "Recommended repairs", "Completed work", "Next service timing"];

const conciergeActions = [
  { icon: Wrench, label: "Schedule Maintenance" },
  { icon: Sparkles, label: "Detail My Car" },
  { icon: ShieldCheck, label: "Need Repairs" },
  { icon: Gauge, label: "Buy a Vehicle" },
  { icon: Car, label: "Sell My Vehicle" },
  { icon: KeyRound, label: "Emergency Assistance" },
  { icon: Warehouse, label: "Storage" },
  { icon: CalendarCheck, label: "Transportation" },
  { icon: ClipboardCheck, label: "Insurance Help" },
  { icon: Upload, label: "Documents" },
];

const ownershipTrackers = [
  "Oil change",
  "Tire swap",
  "Brake inspection",
  "Transmission service",
  "Fluid flush",
  "Diagnostics",
  "Battery age",
  "Tire age",
  "Warranty work",
  "Recalls",
  "Annual inspection",
  "Registration renewal",
  "Insurance",
  "Service bulletins",
  "Storage check",
  "Vehicle exercise",
  "Fuel stabilizer",
  "Transportation",
  "Documents",
];

const defaultGarage = [
  {
    id: "demo-911",
    year: "2021",
    make: "Porsche",
    model: "911 Carrera",
    mileage: "18,400",
    use: "Seasonal",
    status: "Detail due",
    marketValue: "$142,000",
    horsepower: "379 hp",
    vin: "WP0AB2A9-DEMO-911",
    location: "Montreal storage",
    insurance: "Collector policy active",
    warranty: "Factory warranty expired",
    preferredDealer: "Porsche Centre",
    pickupLocation: "Home garage",
    nextService: "Oil change in 42 days",
    tireAge: "2 years",
    batteryAge: "18 months",
    registration: "Renewal due yearly",
    workDone: ["Ceramic coating", "Annual detail", "Battery tender setup"],
    image: "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=900&q=85",
  },
  {
    id: "demo-range",
    year: "2024",
    make: "Range Rover",
    model: "Sport",
    mileage: "7,950",
    use: "Daily",
    status: "Health report ready",
    marketValue: "$118,000",
    horsepower: "355 hp",
    vin: "SALWR2SE-DEMO-RR",
    location: "Daily driver",
    insurance: "Personal policy active",
    warranty: "Factory warranty active",
    preferredDealer: "Land Rover dealer",
    pickupLocation: "Office",
    nextService: "Service in 63 days",
    tireAge: "1 year",
    batteryAge: "9 months",
    registration: "Active",
    workDone: ["Winter tire package", "Interior protection", "Paint protection film"],
    image: "https://images.unsplash.com/photo-1542362567-b07e54358753?auto=format&fit=crop&w=900&q=85",
  },
];

const defaultAppointments = [
  {
    id: "appt-1",
    vehicle: "2021 Porsche 911 Carrera",
    service: "Full detail",
    date: "2026-07-08",
    time: "10:00",
    status: "Requested",
  },
];

const fallbackVehicleImage = "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=900&q=85";

function ensureList(value) {
  return Array.isArray(value) ? value : [];
}

function mergeFeedPosts(newPosts, currentPosts) {
  const byId = new Map();
  [...ensureList(newPosts), ...ensureList(currentPosts)].forEach((post) => {
    if (!post) return;
    byId.set(post.id || `${post.createdAt}-${post.image}`, post);
  });

  return Array.from(byId.values()).sort((a, b) => {
    const aTime = new Date(a.createdAt || 0).getTime();
    const bTime = new Date(b.createdAt || 0).getTime();
    return bTime - aTime;
  });
}

function readNoteValue(notes, label) {
  const line = String(notes || "")
    .split("\n")
    .find((item) => item.toLowerCase().startsWith(`${label.toLowerCase()}:`));
  return line ? line.slice(label.length + 1).trim() : "";
}

function normalizeVehicle(vehicle, index = 0) {
  const safeVehicle = vehicle && typeof vehicle === "object" ? vehicle : {};
  const notes = safeVehicle.notes || "";

  return {
    ...safeVehicle,
    id: safeVehicle.id || `garage-vehicle-${index}`,
    year: safeVehicle.year || "",
    make: safeVehicle.make || "",
    model: safeVehicle.model || "",
    mileage: safeVehicle.mileage || "",
    use: safeVehicle.use || "Collection",
    status: safeVehicle.status || "Active",
    marketValue: safeVehicle.marketValue || "Value pending",
    horsepower: safeVehicle.horsepower || "HP pending",
    workDone: Array.isArray(safeVehicle.workDone) ? safeVehicle.workDone : splitWorkList(safeVehicle.workDone),
    vin: safeVehicle.vin || readNoteValue(notes, "VIN"),
    location: safeVehicle.location || readNoteValue(notes, "Location"),
    insurance: safeVehicle.insurance || readNoteValue(notes, "Insurance"),
    warranty: safeVehicle.warranty || readNoteValue(notes, "Warranty"),
    preferredDealer: safeVehicle.preferredDealer || readNoteValue(notes, "Preferred dealership"),
    pickupLocation: safeVehicle.pickupLocation || readNoteValue(notes, "Preferred pickup"),
    nextService: safeVehicle.nextService || readNoteValue(notes, "Next service") || "Service timing pending",
    lastOilChange: safeVehicle.lastOilChange || readNoteValue(notes, "Last oil change"),
    lastDetail: safeVehicle.lastDetail || readNoteValue(notes, "Last detail"),
    brakeService: safeVehicle.brakeService || readNoteValue(notes, "Brake service"),
    recallStatus: safeVehicle.recallStatus || readNoteValue(notes, "Recall status"),
    serviceInterval: safeVehicle.serviceInterval || readNoteValue(notes, "Service interval"),
    tireSeason: safeVehicle.tireSeason || readNoteValue(notes, "Tire season"),
    color: safeVehicle.color || readNoteValue(notes, "Color"),
    plate: safeVehicle.plate || readNoteValue(notes, "Plate"),
    condition: safeVehicle.condition || readNoteValue(notes, "Condition"),
    storageNeeds: safeVehicle.storageNeeds || readNoteValue(notes, "Storage needs"),
    tireAge: safeVehicle.tireAge || readNoteValue(notes, "Tire age") || "Tire age pending",
    batteryAge: safeVehicle.batteryAge || readNoteValue(notes, "Battery age") || "Battery age pending",
    registration: safeVehicle.registration || readNoteValue(notes, "Registration") || "Registration pending",
    notes,
    image: safeVehicle.image || fallbackVehicleImage,
  };
}

function vehicleTrackingItems(vehicle) {
  const tracked = {
    "Oil change": vehicle.nextService || "Service timing pending",
    "Tire swap": vehicle.tireAge || "Tire age pending",
    "Brake inspection": vehicle.brakeService || vehicle.status || "Inspection pending",
    "Battery age": vehicle.batteryAge || "Battery age pending",
    "Warranty work": vehicle.warranty || "Warranty pending",
    "Recalls": vehicle.recallStatus || "Check with preferred dealer",
    "Annual inspection": "Inspection schedule pending",
    "Registration renewal": vehicle.registration || "Registration pending",
    Insurance: vehicle.insurance || "Insurance pending",
    "Storage check": vehicle.storageNeeds || (vehicle.use === "Collection" || vehicle.use === "Seasonal" ? "Monthly check recommended" : "Not currently required"),
    "Vehicle exercise": vehicle.use === "Collection" || vehicle.use === "Seasonal" ? "Exercise schedule pending" : "Driven regularly",
    Transportation: vehicle.pickupLocation || "Pickup location pending",
    Documents: vehicle.vin ? "VIN on file" : "VIN needed",
  };

  return ownershipTrackers.map((label) => ({
    label,
    detail: tracked[label] || "Track on request",
    status: tracked[label] && !String(tracked[label]).toLowerCase().includes("pending") ? "Tracked" : "Needs info",
  }));
}

function estimateMarketValue(vehicle) {
  const year = Number.parseInt(vehicle.year, 10);
  const makeModel = `${vehicle.make || ""} ${vehicle.model || ""}`.toLowerCase();
  let baseValue = 42000;

  if (makeModel.match(/ferrari|lamborghini|mclaren|bentley|rolls|aston/)) baseValue = 245000;
  else if (makeModel.match(/porsche|911|gt3|range rover|g wagon|amg|bmw m|rs6|rs7/)) baseValue = 112000;
  else if (makeModel.match(/mercedes|bmw|audi|lexus|cadillac|corvette/)) baseValue = 62000;
  else if (makeModel.match(/tesla|ford|chevrolet|gmc|toyota|honda|hyundai|kia|mazda|subaru|volkswagen/)) baseValue = 34000;

  if (year) {
    const age = Math.max(0, new Date().getFullYear() - year);
    const depreciation = makeModel.match(/ferrari|lamborghini|mclaren|gt3|911/) ? Math.min(age * 0.025, 0.2) : Math.min(age * 0.065, 0.62);
    baseValue *= 1 - depreciation;
  }

  const mileage = Number.parseInt(String(vehicle.mileage || "").replace(/\D/g, ""), 10);
  if (mileage > 100000) baseValue *= 0.74;
  else if (mileage > 60000) baseValue *= 0.84;
  else if (mileage > 30000) baseValue *= 0.92;
  else if (mileage && mileage < 10000) baseValue *= 1.06;

  const rounded = Math.max(6000, Math.round(baseValue / 1000) * 1000);
  return `Estimated $${rounded.toLocaleString()}`;
}

function vehicleMarketValue(vehicle) {
  const value = vehicle.marketValue || "";
  if (value && !value.toLowerCase().includes("pending")) return value;
  return estimateMarketValue(vehicle);
}

function parseDueDays(value) {
  const match = String(value || "").match(/(\d+)\s*days?/i);
  return match ? Number(match[1]) : null;
}

function buildServiceReminders(garage, plan) {
  const reminders = [];

  ensureList(garage).forEach((vehicle) => {
    const label = vehicleLabel(vehicle);
    const dueDays = parseDueDays(vehicle.nextService);

    if (dueDays !== null && canBookService(plan, "Oil change")) {
      reminders.push({
        id: `${vehicle.id}-oil`,
        vehicle: label,
        service: "Oil change",
        title: `Oil change due in ${dueDays} days`,
        message: `Would you like White Glove to schedule service for your ${label}?`,
        urgency: dueDays <= 14 ? "Due soon" : "Upcoming",
      });
    }

    if ((String(vehicle.status).toLowerCase().includes("detail") || vehicle.use === "Seasonal" || vehicle.use === "Collection") && canBookService(plan, "Detail my car")) {
      reminders.push({
        id: `${vehicle.id}-detail`,
        vehicle: label,
        service: "Detail my car",
        title: "Would you like to schedule detailing?",
        message: `Keep your ${label} ready, clean, photographed, and protected.`,
        urgency: "Recommended",
      });
    }

    if (String(vehicle.batteryAge).match(/18|24|2 year|3 year/i) && canBookService(plan, "Battery service")) {
      reminders.push({
        id: `${vehicle.id}-battery`,
        vehicle: label,
        service: "Battery service",
        title: "Battery check recommended",
        message: `Your ${label} battery age is ${vehicle.batteryAge}. We can coordinate a test or replacement.`,
        urgency: "Preventive",
      });
    }

    if (String(vehicle.tireAge).match(/2 year|3 year|4 year|5 year/i) && canBookService(plan, "Tires")) {
      reminders.push({
        id: `${vehicle.id}-tires`,
        vehicle: label,
        service: "Tires",
        title: "Tire inspection recommended",
        message: `Your ${label} tire age is ${vehicle.tireAge}. We can arrange inspection, changeover, or replacement.`,
        urgency: "Preventive",
      });
    }
  });

  return reminders.slice(0, 6);
}

function serviceHistoryForVehicle(vehicle, appointments) {
  const label = vehicleLabel(vehicle);
  const workItems = ensureList(vehicle.workDone).map((item, index) => ({
    id: `work-${vehicle.id}-${index}`,
    title: item,
    meta: "Completed work",
    status: "Logged",
  }));
  const requestItems = ensureList(appointments)
    .filter((appointment) => appointment.vehicle === label)
    .map((appointment) => ({
      id: appointment.id,
      title: appointment.service,
      meta: appointment.date ? `${appointment.date}${appointment.time ? ` at ${appointment.time}` : ""}` : "Date pending",
      status: appointment.status || "Requested",
    }));

  return [...requestItems, ...workItems];
}

function formatPostDate(value) {
  if (!value) return "Just now";
  try {
    return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(value));
  } catch {
    return "Just now";
  }
}

function readStoredJson(key, fallback) {
  try {
    const savedValue = localStorage.getItem(key);
    return savedValue ? JSON.parse(savedValue) : fallback;
  } catch {
    localStorage.removeItem(key);
    return fallback;
  }
}

class MemberPanelErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidUpdate(previousProps) {
    if (previousProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <section className="app-section">
          <h2>We could not open this section.</h2>
          <p>Go back home and try again. If it keeps happening, sign out and sign back in.</p>
          <button className="button primary compact-button" type="button" onClick={this.props.onRecover}>
            Back to Home
          </button>
        </section>
      );
    }

    return this.props.children;
  }
}

function App() {
  const [mode, setMode] = useState("site");
  const [menuOpen, setMenuOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [appError, setAppError] = useState("");
  const [checkoutCompletion, setCheckoutCompletion] = useState(null);
  const [adminMode, setAdminMode] = useState(() => window.location.hash === "#admin");
  const [runtimeError, setRuntimeError] = useState("");
  const [loadingAccount, setLoadingAccount] = useState(isBackendConfigured);
  const [member, setMember] = useState(() => {
    if (isBackendConfigured) return null;
    return readStoredJson("carClubMember", null);
  });
  const [garage, setGarage] = useState(() => {
    return ensureList(readStoredJson("carClubGarage", defaultGarage));
  });
  const [appointments, setAppointments] = useState(() => {
    return ensureList(readStoredJson("carClubAppointments", defaultAppointments));
  });
  const [feedPosts, setFeedPosts] = useState(() => {
    return ensureList(readStoredJson("carClubFeedPosts", []));
  });

  const closeMenu = () => setMenuOpen(false);

  useEffect(() => {
    function readAdminHash() {
      setAdminMode(window.location.hash === "#admin");
    }

    window.addEventListener("hashchange", readAdminHash);
    return () => window.removeEventListener("hashchange", readAdminHash);
  }, []);

  useEffect(() => {
    if (!isBackendConfigured || !member?.id) return undefined;

    const unsubscribe = subscribeToFeedPosts((newPost) => {
      setFeedPosts((currentPosts) => mergeFeedPosts([newPost], currentPosts));
    });

    return unsubscribe;
  }, [member?.id]);

  const refreshFeedPosts = useCallback(async () => {
    if (!isBackendConfigured) {
      const storedPosts = ensureList(readStoredJson("carClubFeedPosts", []));
      setFeedPosts(storedPosts);
      return storedPosts;
    }

    const savedFeedPosts = await loadFeedPosts();
    setFeedPosts(ensureList(savedFeedPosts));
    return savedFeedPosts;
  }, []);

  useEffect(() => {
    function reportRuntimeError(event) {
      if (event.target && event.target !== window) return;
      setRuntimeError(event.reason?.message || event.error?.message || event.message || "The app hit an unexpected error.");
    }

    window.addEventListener("error", reportRuntimeError);
    window.addEventListener("unhandledrejection", reportRuntimeError);

    return () => {
      window.removeEventListener("error", reportRuntimeError);
      window.removeEventListener("unhandledrejection", reportRuntimeError);
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const bookingStatus = params.get("booking");

    if (bookingStatus === "success") {
      setCheckoutCompletion({
        actionLabel: "View Requests",
        actionTab: "schedule",
        details: [
          ["Payment", "Processed through Stripe"],
          ["Email", "Booking confirmation sent"],
        ],
        message: "Your booking is confirmed. A confirmation email has been sent, and your service demand is now in the backend portal.",
        secondaryLabel: "Back Home",
        secondaryTab: "home",
        title: "Booking confirmed.",
      });
      setMode("app");
      window.history.replaceState({}, "", window.location.pathname);
    }

    if (bookingStatus === "cancelled") {
      setAppError("Payment was cancelled. Your booking was not confirmed.");
      setMode("app");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  useEffect(() => {
    let active = true;

    async function loadAccount() {
      if (!isBackendConfigured) {
        setLoadingAccount(false);
        return;
      }

      try {
        const currentMember = await getCurrentMember();
        if (!active || !currentMember) {
          if (active) setMember(null);
          setLoadingAccount(false);
          return;
        }

        const [savedGarage, savedAppointments, savedFeedPosts] = await Promise.all([
          loadVehicles(currentMember.id),
          loadServiceRequests(currentMember.id),
          loadFeedPosts(),
        ]);

        if (!active) return;
        setMember(currentMember);
        setGarage(ensureList(savedGarage));
        setAppointments(ensureList(savedAppointments));
        setFeedPosts(ensureList(savedFeedPosts));
        setMode("app");
      } catch (error) {
        if (active) setAppError(error.message || "Could not load your account.");
      } finally {
        if (active) setLoadingAccount(false);
      }
    }

    loadAccount();

    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitError("");

    const form = event.currentTarget;
    const formData = new FormData(form);
    formData.set("services", formData.getAll("services").join(", "));

    try {
      if (window.location.hostname !== "127.0.0.1" && window.location.hostname !== "localhost") {
        const response = await fetch("/", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams(formData).toString(),
        });

        if (!response.ok) {
          throw new Error("Lead submission failed");
        }
      }

      setSubmitted(true);
      form.reset();
    } catch {
      setSubmitError("Something went wrong. Please try again or contact us directly.");
    }
  }

  async function handleLogin(profile) {
    setAppError("");

    if (isBackendConfigured) {
      const signedInMember = profile.authAction === "create"
        ? await createAccount(profile)
        : await signIn(profile);
      if (signedInMember.pendingConfirmation) {
        setAppError(`Account created for ${signedInMember.email}. Check your email to confirm your account, then sign in.`);
        return;
      }

      const [savedGarage, savedAppointments, savedFeedPosts] = await Promise.all([
        loadVehicles(signedInMember.id),
        loadServiceRequests(signedInMember.id),
        loadFeedPosts(),
      ]);

      setMember(signedInMember);
      setGarage(ensureList(savedGarage));
      setAppointments(ensureList(savedAppointments));
      setFeedPosts(ensureList(savedFeedPosts));
      setMode("app");
      return;
    }

    localStorage.setItem("carClubMember", JSON.stringify(profile));
    localStorage.setItem("carClubGarage", JSON.stringify(garage));
    localStorage.setItem("carClubAppointments", JSON.stringify(appointments));
    setMember(profile);
    setMode("app");
  }

  async function handleLogout() {
    await signOut();
    localStorage.removeItem("carClubMember");
    setMember(null);
    setMode("site");
  }

  async function handleUpdateMember(settings) {
    const nextPlan = settings.plan || member?.plan || "Club Drive";

    if (!canAddGarageVehicle(nextPlan, garage.length) && garage.length > 1) {
      throw new Error("This package supports one garage vehicle. Keep Collector active to manage multiple vehicles.");
    }

    const nextMember = {
      ...member,
      avatarUrl: settings.avatarUrl || member?.avatarUrl || "",
      name: settings.name?.trim() || member?.name || "Member",
      username: settings.username?.trim() || "",
      plan: nextPlan,
      notifications: {
        ...defaultNotificationSettings,
        ...(member?.notifications || {}),
        ...(settings.notifications || {}),
      },
    };

    if (isBackendConfigured && member?.id) {
      const savedMember = await updateMemberProfile({
        id: member.id,
        avatarUrl: nextMember.avatarUrl,
        email: member.email,
        name: nextMember.name,
        username: nextMember.username,
        plan: nextMember.plan,
        notifications: nextMember.notifications,
      });

      if (settings.password) {
        await updateMemberPassword(settings.password);
      }

      setMember((currentMember) => ({ ...currentMember, ...savedMember }));
      return savedMember;
    }

    localStorage.setItem("carClubMember", JSON.stringify(nextMember));
    setMember(nextMember);
    return nextMember;
  }

  async function addVehicle(vehicle) {
    if (!canAddGarageVehicle(member?.plan, garage.length)) {
      throw new Error("Your current package includes one garage vehicle. Upgrade to the Collector package to manage multiple cars.");
    }

    if (isBackendConfigured && member?.id) {
      const savedVehicle = await createVehicle(member.id, { ...vehicle, status: "New vehicle added" });
      setGarage((currentGarage) => [savedVehicle, ...currentGarage]);
      return savedVehicle;
    }

    const nextGarage = [{ ...vehicle, id: crypto.randomUUID(), status: "New vehicle added", workDone: vehicle.workDone || [] }, ...garage];
    localStorage.setItem("carClubGarage", JSON.stringify(nextGarage));
    setGarage(nextGarage);
    return nextGarage[0];
  }

  async function updateVehicle(vehicleId, updates) {
    if (isBackendConfigured && member?.id) {
      const savedVehicle = await updateVehicleRecord(vehicleId, updates);
      setGarage((currentGarage) => currentGarage.map((vehicle) => (vehicle.id === vehicleId ? savedVehicle : vehicle)));
      return savedVehicle;
    }

    const nextGarage = garage.map((vehicle) => (vehicle.id === vehicleId ? { ...vehicle, ...updates } : vehicle));
    localStorage.setItem("carClubGarage", JSON.stringify(nextGarage));
    setGarage(nextGarage);
    return nextGarage.find((vehicle) => vehicle.id === vehicleId);
  }

  async function deleteVehicle(vehicleId) {
    if (isBackendConfigured && member?.id) {
      await deleteVehicleRecord(vehicleId);
      setGarage((currentGarage) => currentGarage.filter((vehicle) => vehicle.id !== vehicleId));
      return;
    }

    const nextGarage = garage.filter((vehicle) => vehicle.id !== vehicleId);
    localStorage.setItem("carClubGarage", JSON.stringify(nextGarage));
    setGarage(nextGarage);
  }

  async function addAppointment(appointment) {
    if (!canBookService(member?.plan, appointment.service)) {
      throw new Error(`${appointment.service} is not included in the ${member?.plan || "current"} package.`);
    }

    if (isBackendConfigured && member?.id) {
      const savedRequest = await createServiceRequest(member.id, appointment);
      setAppointments((currentAppointments) => [savedRequest, ...currentAppointments]);
      return savedRequest;
    }

    const nextAppointments = [{ ...appointment, id: crypto.randomUUID(), status: "Requested" }, ...appointments];
    localStorage.setItem("carClubAppointments", JSON.stringify(nextAppointments));
    setAppointments(nextAppointments);
    return nextAppointments[0];
  }

  async function addFeedPost(post) {
    if (isBackendConfigured && member?.id) {
      const savedPost = await createFeedPost(member.id, post, member.name);
      setFeedPosts((currentPosts) => mergeFeedPosts([savedPost], currentPosts));
      return savedPost;
    }

    const nextPost = {
      ...post,
      id: crypto.randomUUID(),
      author: member?.name || "Member",
      createdAt: new Date().toISOString(),
    };
    const nextPosts = [nextPost, ...feedPosts];
    localStorage.setItem("carClubFeedPosts", JSON.stringify(nextPosts));
    setFeedPosts(nextPosts);
    return nextPost;
  }

  if (mode === "login") {
    return <LoginScreen appError={appError} backendEnabled={isBackendConfigured} onLogin={handleLogin} onBack={() => setMode("site")} />;
  }

  if (runtimeError) {
    return <RuntimeErrorScreen message={runtimeError} onReset={() => { setRuntimeError(""); setMode("site"); }} />;
  }

  if (adminMode) {
    return <AdminPortal onBack={() => { window.location.hash = ""; setAdminMode(false); }} />;
  }

  if (loadingAccount) {
    return (
      <main className="login-screen">
        <section className="phone-auth">
          <div className="auth-brand">
            <span className="brand-mark">WG</span>
            <span>White Glove</span>
          </div>
          <h1>Loading your account.</h1>
          <p>Checking for an existing member session.</p>
        </section>
      </main>
    );
  }

  if (mode === "app" && member) {
    return <MemberApp appointments={appointments} feedPosts={feedPosts} garage={garage} initialCompletion={checkoutCompletion} member={member} onAddAppointment={addAppointment} onAddFeedPost={addFeedPost} onAddVehicle={addVehicle} onDeleteVehicle={deleteVehicle} onLogout={handleLogout} onRefreshFeedPosts={refreshFeedPosts} onUpdateMember={handleUpdateMember} onUpdateVehicle={updateVehicle} />;
  }

  if (mode === "app") {
    return <LoginScreen appError="Please sign in to access your member app." backendEnabled={isBackendConfigured} onLogin={handleLogin} onBack={() => setMode("site")} />;
  }

  if (mode === "privacy") {
    return <PrivacyPolicy onBack={() => setMode("site")} />;
  }

  return (
    <div className="site-shell">
      <header className="nav">
        <a className="brand" href="#top" onClick={closeMenu} aria-label="White Glove Concierge home">
          <span className="brand-mark">WG</span>
          <span>
            <strong>White Glove Concierge</strong>
            <small>Collection Management</small>
          </span>
        </a>
        <button className="menu-toggle" type="button" onClick={() => setMenuOpen((open) => !open)} aria-label="Toggle navigation">
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
        <nav className={menuOpen ? "nav-links open" : "nav-links"} aria-label="Primary navigation">
          <a href="#services" onClick={closeMenu}>Services</a>
          <a href="#memberships" onClick={closeMenu}>Memberships</a>
          <button className="nav-button profile-nav-button" type="button" onClick={() => setMode(member ? "app" : "login")}>
            <ProfileAvatar member={member} size={24} /> Member App
          </button>
          <a href="#apply" onClick={closeMenu}>Apply</a>
        </nav>
      </header>

      <main id="top">
        <section className="hero">
          <div className="hero-media" aria-hidden="true" />
          <div className="hero-overlay" />
          <div className="hero-content">
            <p className="eyebrow">One membership. One point of contact. Zero hassle.</p>
            <h1>Vehicle ownership, fully managed.</h1>
            <p className="hero-copy">
              White Glove Concierge handles every automotive need through one dedicated concierge. Maintenance, detailing, transportation, storage, buying, selling, repairs, emergencies, collections, and fleet support, all coordinated for you.
            </p>
            <div className="hero-actions">
              <button className="button primary" type="button" onClick={() => setMode(member ? "app" : "login")}>
                Open Member App <ArrowRight size={18} />
              </button>
              <a className="button secondary" href="#apply">
                Request a Consultation <CalendarCheck size={18} />
              </a>
            </div>
          </div>
          <div className="hero-panel" aria-label="Service highlights">
            <div>
              <strong>One contact</strong>
              <span>text your concierge</span>
            </div>
            <div>
              <strong>One app</strong>
              <span>manage every vehicle</span>
            </div>
            <div>
              <strong>One network</strong>
              <span>vetted service partners</span>
            </div>
          </div>
        </section>

        <section className="section app-preview-section">
          <div className="section-heading">
            <p className="eyebrow">Member app</p>
            <h2>Open the app, tell us what you need, and your concierge coordinates the rest.</h2>
          </div>
          <div className="app-preview-grid">
            <article>
              <Upload size={24} />
              <h3>Upload Your Garage</h3>
              <p>Add vehicles with VIN, mileage, location, warranty, insurance, photos, value, and notes.</p>
            </article>
            <article>
              <CalendarCheck size={24} />
              <h3>Schedule Anything</h3>
              <p>Maintenance, repairs, detailing, storage, transport, buying, selling, roadside, and insurance help.</p>
            </article>
            <article>
              <ClipboardCheck size={24} />
              <h3>Track Ownership</h3>
              <p>See upcoming service, recalls, records, completed work, market value, and concierge updates.</p>
            </article>
          </div>
        </section>

        <section className="section how">
          <div className="section-heading">
            <p className="eyebrow">How it works</p>
            <h2>You own the vehicle. We manage the ownership experience.</h2>
          </div>
          <div className="steps">
            {[
              ["Join White Glove", "Add your vehicles, VINs, mileage, location, insurance, warranty, preferred dealer, and pickup details."],
              ["We Track Everything", "Your app monitors service intervals, tires, brakes, recalls, registration, battery age, records, and upcoming needs."],
              ["Tap Schedule Service", "Your concierge compares vetted providers, pricing, availability, reviews, distance, and transportation options, then books it."],
            ].map(([title, copy], index) => (
              <article className="step-card" key={title}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <h3>{title}</h3>
                <p>{copy}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="section services" id="services">
          <div className="section-heading">
            <p className="eyebrow">Automotive ownership management</p>
            <h2>From daily drivers to million-dollar collections, every need is handled through one concierge.</h2>
          </div>
          <div className="service-grid">
            {services.map(({ icon: Icon, title, items }) => (
              <article className="service-card" key={title}>
                <Icon size={26} />
                <h3>{title}</h3>
                <ul>
                  {items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section className="section split" id="memberships">
          <div className="section-heading compact">
            <p className="eyebrow">Memberships</p>
            <h2>Simple monthly membership, with concierge coordination and partner services as needed.</h2>
          </div>
          <div className="plan-grid">
            {plans.map((plan) => (
              <article className={plan.featured ? "plan-card featured" : "plan-card"} key={plan.name}>
                {plan.featured && <span className="plan-badge">Popular</span>}
                <h3>{plan.name}</h3>
                <p>{plan.intro}</p>
                <div className="price">
                  <strong>{plan.price}</strong>
                  <span>{plan.cadence}</span>
                </div>
                <ul>
                  {plan.features.map((feature) => (
                    <li key={feature}>
                      <Check size={16} /> {feature}
                    </li>
                  ))}
                </ul>
                <a className={plan.name === "Collector" ? "button secondary full" : "button primary full"} href="#apply">
                  {plan.name === "Collector" ? "Apply for Collector Plan" : "Become a Member"}
                </a>
              </article>
            ))}
          </div>
        </section>

        <section className="image-band" id="collectors">
          <div className="image-band-media" aria-hidden="true" />
          <div className="image-band-copy">
            <p className="eyebrow">Collection management</p>
            <h2>Built for collectors, busy owners, and companies with 5 to 100 vehicles.</h2>
            <p>
              Keep every vehicle ready, protected, documented, and properly serviced with a dedicated care plan. We coordinate maintenance, transportation, storage, inspections, buying, selling, paperwork, and emergency support through a trusted partner network.
            </p>
          </div>
        </section>

        <section className="section value">
          <div className="section-heading">
            <p className="eyebrow">Why join</p>
            <h2>Stop managing shops, schedules, transport, repairs, and paperwork yourself.</h2>
          </div>
          <div className="benefit-grid">
            {benefits.map((benefit) => (
              <div className="benefit" key={benefit}>
                <Check size={18} />
                <span>{benefit}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="section reports">
          <div>
            <p className="eyebrow">Vehicle health reports</p>
            <h2>Every vehicle gets a clearer ownership record.</h2>
            <p>
              Members receive digital reports after service, checkups, and concierge requests, making it easier to plan maintenance, understand condition, document history, and preserve resale value.
            </p>
          </div>
          <div className="report-card">
            <div className="report-card-header">
              <Car size={28} />
              <span>Digital Care Report</span>
            </div>
            <div className="report-list">
              {reportItems.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
          </div>
        </section>

        <LeadSection handleSubmit={handleSubmit} submitted={submitted} submitError={submitError} />
      </main>

      <footer className="footer">
        <div>
          <strong>White Glove Concierge</strong>
          <span>Collection management, managed for you.</span>
        </div>
        <div className="footer-actions">
          <button type="button" onClick={() => setMode("privacy")}>Privacy Policy</button>
          <button type="button" onClick={() => setMode(member ? "app" : "login")}>Open Member App</button>
        </div>
      </footer>
    </div>
  );
}

function PrivacyPolicy({ onBack }) {
  return (
    <main className="legal-page">
      <section className="legal-card">
        <button className="text-button" type="button" onClick={onBack}>Back to site</button>
        <p className="eyebrow">Privacy Policy</p>
        <h1>White Glove Concierge Privacy Policy</h1>
        <p>Last updated: July 6, 2026</p>

        <h2>Information We Collect</h2>
        <p>
          We collect information members provide when requesting membership, creating an account, adding garage vehicles, uploading vehicle photos, updating market value, horsepower, VIN, mileage, location, insurance notes, warranty notes, preferred dealership, pickup location, modifications, service history, and submitting concierge service, buying, selling, transport, storage, emergency, or vehicle offer requests.
        </p>

        <h2>How We Use Information</h2>
        <p>
          We use this information to manage member accounts, maintain garage records, coordinate services, respond to offer requests, communicate with members, improve the app, and provide collection management support.
        </p>

        <h2>Storage and Service Providers</h2>
        <p>
          Member account, vehicle, photo, and service request information may be processed through service providers such as Supabase and Netlify so the website and member app can operate securely.
        </p>

        <h2>Member Choices</h2>
        <p>
          Members may contact White Glove Concierge to request updates, corrections, or deletion of account and vehicle information.
        </p>

        <h2>Contact</h2>
        <p>
          For privacy questions, contact White Glove Concierge through the website contact or membership request form.
        </p>
      </section>
    </main>
  );
}

function RuntimeErrorScreen({ message, onReset }) {
  return (
    <main className="login-screen">
      <section className="phone-auth">
        <div className="auth-brand">
          <span className="brand-mark">WG</span>
          <span>White Glove Member App</span>
        </div>
        <h1>Something stopped the app.</h1>
        <p>{message}</p>
        <button className="button primary submit" type="button" onClick={onReset}>
          Back to Website
        </button>
      </section>
    </main>
  );
}

function AdminPaymentEditor({ onSave, request }) {
  const [paymentMode, setPaymentMode] = useState("deposit");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentNote, setPaymentNote] = useState("");
  const [savingPayment, setSavingPayment] = useState(false);

  async function submitPaymentUpdate(event) {
    event.preventDefault();

    if (paymentMode !== "no-payment" && !paymentAmount) {
      return;
    }

    const paymentLabels = {
      deposit: "Security deposit",
      full: "Full amount",
      "no-payment": "No payment due",
      custom: "Custom payment",
    };

    setSavingPayment(true);
    try {
      await onSave(request.id, {
        paymentMode,
        paymentTitle: paymentLabels[paymentMode],
        paymentAmount: paymentMode === "no-payment" ? "No payment due" : `$${Number(paymentAmount || 0).toFixed(2)} CAD`,
        paymentNote,
      });
      setPaymentAmount("");
      setPaymentNote("");
    } finally {
      setSavingPayment(false);
    }
  }

  return (
    <form className="admin-payment-editor" onSubmit={submitPaymentUpdate}>
      <div className="admin-payment-heading">
        <strong><CreditCard size={16} /> Payment adjustment</strong>
        <p>Set what this member should pay for this booking request.</p>
      </div>
      <div className="admin-payment-grid">
        <label>
          Payment type
          <select value={paymentMode} onChange={(event) => setPaymentMode(event.target.value)}>
            <option value="deposit">Security deposit</option>
            <option value="full">Full amount</option>
            <option value="no-payment">No payment due</option>
            <option value="custom">Custom payment</option>
          </select>
        </label>
        <label>
          Amount CAD
          <input
            type="number"
            min="0"
            step="0.01"
            value={paymentAmount}
            onChange={(event) => setPaymentAmount(event.target.value)}
            placeholder="150.00"
            disabled={paymentMode === "no-payment"}
          />
        </label>
      </div>
      <label>
        Admin note
        <textarea
          rows="2"
          value={paymentNote}
          onChange={(event) => setPaymentNote(event.target.value)}
          placeholder="Provider quote, reason for price change, or payment instructions..."
        />
      </label>
      <button className="button secondary compact-button" type="submit" disabled={savingPayment || (paymentMode !== "no-payment" && !paymentAmount)}>
        {savingPayment ? "Saving..." : "Save Payment Update"}
      </button>
    </form>
  );
}

function AdminPortal({ onBack }) {
  const [adminToken, setAdminToken] = useState(() => localStorage.getItem("whiteGloveAdminToken") || "");
  const [draftToken, setDraftToken] = useState(adminToken);
  const [adminError, setAdminError] = useState("");
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [serviceRequests, setServiceRequests] = useState([]);

  async function loadAdminRequests(token = adminToken) {
    if (!token) return;
    setAdminError("");
    setLoadingRequests(true);

    try {
      const response = await fetch("/.netlify/functions/admin-service-requests", {
        headers: { "x-admin-token": token },
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error || "Could not load service demands.");
      }

      setServiceRequests(payload.requests || []);
    } catch (error) {
      setAdminError(error.message || "Could not load service demands.");
    } finally {
      setLoadingRequests(false);
    }
  }

  async function submitAdminLogin(event) {
    event.preventDefault();
    localStorage.setItem("whiteGloveAdminToken", draftToken);
    setAdminToken(draftToken);
    await loadAdminRequests(draftToken);
  }

  async function updateDemandStatus(id, status) {
    setAdminError("");

    try {
      const response = await fetch("/.netlify/functions/admin-service-requests", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": adminToken,
        },
        body: JSON.stringify({ id, status }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error || "Could not update the service demand.");
      }

      setServiceRequests((requests) => requests.map((request) => (request.id === id ? { ...request, ...payload.request } : request)));
    } catch (error) {
      setAdminError(error.message || "Could not update the service demand.");
    }
  }

  async function updateDemandPayment(id, paymentUpdate) {
    setAdminError("");

    try {
      const response = await fetch("/.netlify/functions/admin-service-requests", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": adminToken,
        },
        body: JSON.stringify({ id, ...paymentUpdate }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error || "Could not update the booking payment.");
      }

      setServiceRequests((requests) => requests.map((request) => (request.id === id ? { ...request, ...payload.request } : request)));
    } catch (error) {
      setAdminError(error.message || "Could not update the booking payment.");
    }
  }

  useEffect(() => {
    if (adminToken) {
      loadAdminRequests(adminToken);
    }
  }, []);

  return (
    <main className="admin-portal">
      <section className="admin-shell">
        <div className="admin-header">
          <div>
            <p className="eyebrow">White Glove backend</p>
            <h1>Service Demand Portal</h1>
            <p>Review paid bookings, member service requests, preferred timing, vehicle details, and concierge status.</p>
          </div>
          <button className="button secondary compact-button" type="button" onClick={onBack}>Back To Website</button>
        </div>

        <form className="admin-login-card" onSubmit={submitAdminLogin}>
          <label>
            Admin password
            <input type="password" value={draftToken} onChange={(event) => setDraftToken(event.target.value)} placeholder="Enter backend portal password" />
          </label>
          <button className="button primary compact-button" type="submit">
            <KeyRound size={18} /> Open Portal
          </button>
          <button className="button secondary compact-button" type="button" onClick={() => loadAdminRequests(adminToken)} disabled={!adminToken || loadingRequests}>
            {loadingRequests ? "Loading..." : "Refresh"}
          </button>
        </form>

        {adminError && <div className="error-message">{adminError}</div>}

        <div className="admin-request-grid">
          {serviceRequests.length === 0 ? (
            <article className="admin-empty-card">
              <h2>{adminToken ? "No service demands yet" : "Enter your admin password"}</h2>
              <p>{adminToken ? "New bookings and service requests will appear here." : "Set ADMIN_PORTAL_PASSWORD in Netlify, then use that password here."}</p>
            </article>
          ) : (
            serviceRequests.map((request) => (
              <article className="admin-request-card" key={request.id}>
                <div>
                  <span>{request.status || "Requested"}</span>
                  <h2>{request.service_type}</h2>
                  <p>{request.vehicle_label}</p>
                </div>
                <dl>
                  <div>
                    <dt>Member</dt>
                    <dd>{request.member?.full_name || "Member"} · {request.member?.email || "Email pending"}</dd>
                  </div>
                  <div>
                    <dt>Package</dt>
                    <dd>{request.member?.plan || "Unknown"}</dd>
                  </div>
                  <div>
                    <dt>Preferred time</dt>
                    <dd>{request.preferred_date || "Date pending"} {request.preferred_time || ""}</dd>
                  </div>
                  <div>
                    <dt>Received</dt>
                    <dd>{request.created_at ? new Date(request.created_at).toLocaleString() : "Just now"}</dd>
                  </div>
                </dl>
                <AdminPaymentEditor request={request} onSave={updateDemandPayment} />
                {request.notes && <pre>{request.notes}</pre>}
                <div className="admin-status-actions">
                  {["Requested", "In Review", "Booked", "Paid / Confirmed", "Completed"].map((status) => (
                    <button key={status} type="button" onClick={() => updateDemandStatus(request.id, status)}>
                      {status}
                    </button>
                  ))}
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </main>
  );
}

function LoginScreen({ appError, backendEnabled, onBack, onLogin }) {
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authNotice, setAuthNotice] = useState("");
  const appErrorIsNotice = appError?.startsWith("Account created.");

  async function submitLogin(event) {
    event.preventDefault();
    setAuthError("");
    setAuthNotice("");
    setAuthLoading(true);

    const formData = new FormData(event.currentTarget);
    const authAction = event.nativeEvent.submitter?.value || "signin";

    try {
      await onLogin({
        authAction,
        name: formData.get("name") || "Member",
        email: formData.get("email") || "member@whitegloveconcierge.com",
        password: formData.get("password"),
        plan: formData.get("plan") || "Club Drive",
      });
    } catch (error) {
      setAuthError(error.message || "Could not access your account.");
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleResendConfirmation() {
    setAuthError("");
    setAuthNotice("");

    const emailInput = document.querySelector(".app-form input[name='email']");
    const email = emailInput?.value;

    if (!email) {
      setAuthError("Enter your email first, then resend the confirmation.");
      return;
    }

    try {
      setAuthLoading(true);
      await resendConfirmationEmail(email);
      setAuthNotice("Confirmation email sent again. Check your inbox and spam folder.");
    } catch (error) {
      setAuthError(error.message || "Could not resend the confirmation email.");
    } finally {
      setAuthLoading(false);
    }
  }

  return (
    <main className="login-screen">
      <section className="phone-auth">
        <button className="text-button" type="button" onClick={onBack}>Back to site</button>
        <div className="auth-brand">
          <span className="brand-mark">WG</span>
          <span>White Glove Member App</span>
        </div>
        <h1>Log in to your vehicle concierge account.</h1>
        <p>{backendEnabled ? "Use your member email and password to access saved vehicles and service requests." : "Backend keys are not connected yet, so this runs in local prototype mode."}</p>
        <form className="app-form" onSubmit={submitLogin}>
          {authError && (
            <div className="error-message" role="alert">
              {authError}
            </div>
          )}
          {authNotice && (
            <div className="success-message" role="status">
              {authNotice}
            </div>
          )}
          {appError && (
            <div className={appErrorIsNotice ? "success-message" : "error-message"} role={appErrorIsNotice ? "status" : "alert"}>
              {appError}
            </div>
          )}
          <label>
            Full name
            <input name="name" type="text" placeholder="Dionisio De Luca" />
          </label>
          <label>
            Email
            <input name="email" type="email" placeholder="you@example.com" required />
          </label>
          <label>
            Password
            <input name="password" type="password" placeholder="Minimum 6 characters" required />
          </label>
          <label>
            Membership
            <select name="plan">
              <option>Club Drive</option>
              <option>Silver</option>
              <option>Gold</option>
              <option>Platinum</option>
              <option>Collector</option>
            </select>
          </label>
          <button className="button primary submit" name="authAction" type="submit" value="signin" disabled={authLoading}>
            {authLoading ? "Working..." : "Sign In"} <ArrowRight size={18} />
          </button>
          <button className="button secondary submit" name="authAction" type="submit" value="create" disabled={authLoading}>
            Create Account
          </button>
          <button className="button ghost submit" type="button" onClick={handleResendConfirmation} disabled={authLoading || !backendEnabled}>
            Resend Confirmation Email
          </button>
        </form>
      </section>
    </main>
  );
}

function MemberApp({ appointments, feedPosts, garage, initialCompletion, member, onAddAppointment, onAddFeedPost, onAddVehicle, onDeleteVehicle, onLogout, onRefreshFeedPosts, onUpdateMember, onUpdateVehicle }) {
  const [activeTab, setActiveTab] = useState("home");
  const [completion, setCompletion] = useState(null);
  const garageList = ensureList(garage).map(normalizeVehicle);
  const appointmentList = ensureList(appointments);
  const vehicleOptions = useMemo(() => garageList.map((vehicle) => `${vehicle.year || ""} ${vehicle.make || ""} ${vehicle.model || ""}`.trim() || "Garage vehicle"), [garageList]);
  const firstName = member.name?.split(" ")[0] || "Member";
  const navigateToTab = (tab) => {
    setCompletion(null);
    setActiveTab(tab);
  };

  useEffect(() => {
    if (initialCompletion) {
      setCompletion(initialCompletion);
      setActiveTab(initialCompletion.actionTab || "schedule");
    }
  }, [initialCompletion]);

  useEffect(() => {
    if (activeTab === "feed" && !completion) {
      onRefreshFeedPosts?.().catch(() => {});
    }
  }, [activeTab, completion, onRefreshFeedPosts]);

  return (
    <div className="mobile-app-shell">
      <aside className="app-sidebar">
        <div className="auth-brand">
          <span className="brand-mark">WG</span>
          <span>White Glove</span>
        </div>
        <nav>
          <AppNavButton active={activeTab === "home" && !completion} icon={Home} label="Home" onClick={() => navigateToTab("home")} />
          <AppNavButton active={activeTab === "garage" && !completion} icon={Car} label="Garage" onClick={() => navigateToTab("garage")} />
          <AppNavButton active={activeTab === "schedule" && !completion} icon={CalendarCheck} label="Schedule" onClick={() => navigateToTab("schedule")} />
          <AppNavButton active={activeTab === "feed" && !completion} icon={Upload} label="Feed" onClick={() => navigateToTab("feed")} />
          <AppNavButton active={activeTab === "account" && !completion} icon={User} label="Account" onClick={() => navigateToTab("account")} />
        </nav>
      </aside>

      <main className="app-main">
        <header className="app-topbar">
          <div>
            <p className="eyebrow">Member app</p>
            <h1>{completion ? "Successfully Updated" : activeTab === "home" ? `Welcome, ${firstName}` : tabTitle(activeTab)}</h1>
          </div>
          <button className="icon-button profile-settings-button" type="button" aria-label="Profile settings" onClick={() => navigateToTab("account")}>
            <ProfileAvatar member={member} size={32} />
          </button>
        </header>

        <MemberPanelErrorBoundary resetKey={activeTab} onRecover={() => setActiveTab("home")}>
          {completion && <CompletionScreen completion={completion} onNavigate={navigateToTab} />}
          {!completion && activeTab === "home" && (
            <Dashboard
              appointments={appointmentList}
              garage={garageList}
              member={member}
              onAddAppointment={onAddAppointment}
              setActiveTab={setActiveTab}
              onComplete={setCompletion}
            />
          )}
          {!completion && activeTab === "garage" && <GarageScreen appointments={appointmentList} garage={garageList} member={member} onAddAppointment={onAddAppointment} onAddVehicle={onAddVehicle} onDeleteVehicle={onDeleteVehicle} onUpdateVehicle={onUpdateVehicle} onComplete={setCompletion} />}
          {!completion && activeTab === "schedule" && <ScheduleScreen appointments={appointmentList} garage={garageList} member={member} onAddAppointment={onAddAppointment} onComplete={setCompletion} setActiveTab={setActiveTab} vehicleOptions={vehicleOptions} />}
          {!completion && activeTab === "feed" && <FeedScreen feedPosts={feedPosts} member={member} onAddFeedPost={onAddFeedPost} onComplete={setCompletion} onRefreshFeedPosts={onRefreshFeedPosts} vehicleOptions={vehicleOptions} />}
          {!completion && activeTab === "account" && <AccountScreen garageCount={garageList.length} member={member} onLogout={onLogout} onUpdateMember={onUpdateMember} />}
        </MemberPanelErrorBoundary>
      </main>

      <nav className="bottom-tabs" aria-label="App navigation">
        <AppNavButton active={activeTab === "home" && !completion} icon={Home} label="Home" onClick={() => navigateToTab("home")} />
        <AppNavButton active={activeTab === "garage" && !completion} icon={Car} label="Garage" onClick={() => navigateToTab("garage")} />
        <AppNavButton active={activeTab === "schedule" && !completion} icon={CalendarCheck} label="Book" onClick={() => navigateToTab("schedule")} />
        <AppNavButton active={activeTab === "feed" && !completion} icon={Upload} label="Feed" onClick={() => navigateToTab("feed")} />
      </nav>
    </div>
  );
}

function CompletionScreen({ completion, onNavigate }) {
  const {
    actionLabel = "Back Home",
    actionTab = "home",
    details = [],
    message = "Your concierge team has the latest details.",
    secondaryLabel = "View Requests",
    secondaryTab = "schedule",
    title = "Successfully updated.",
  } = completion || {};

  return (
    <section className="completion-screen">
      <div className="completion-mark">
        <Check size={34} />
      </div>
      <p className="eyebrow">White Glove Concierge</p>
      <h2>{title}</h2>
      <p>{message}</p>
      {details.length > 0 && (
        <div className="completion-details">
          {details.map(([label, value]) => (
            <article key={label}>
              <span>{label}</span>
              <strong>{value || "Pending"}</strong>
            </article>
          ))}
        </div>
      )}
      <div className="completion-actions">
        <button className="button primary" type="button" onClick={() => onNavigate(actionTab)}>
          {actionLabel}
        </button>
        <button className="button secondary" type="button" onClick={() => onNavigate(secondaryTab)}>
          {secondaryLabel}
        </button>
      </div>
    </section>
  );
}

function Dashboard({ appointments, garage, member, onAddAppointment, onComplete, setActiveTab }) {
  const serviceReminders = buildServiceReminders(garage, member.plan);

  async function sendReminderRequest(reminder) {
    const savedRequest = await onAddAppointment({
      vehicle: reminder.vehicle,
      service: reminder.service,
      date: "",
      time: "",
      notes: `${reminder.title}. ${reminder.message}`,
    });

    onComplete?.({
      actionLabel: "View Requests",
      actionTab: "schedule",
      details: [
        ["Service", savedRequest?.service || reminder.service],
        ["Vehicle", savedRequest?.vehicle || reminder.vehicle],
        ["Status", savedRequest?.status || "Requested"],
      ],
      message: "Your concierge request has been sent from the service reminder. White Glove will coordinate the appointment details.",
      secondaryLabel: "Back Home",
      secondaryTab: "home",
      title: "Service request successfully sent.",
    });
  }

  return (
    <div className="app-stack">
      <section className="app-section home-priority">
        <div className="app-section-title">
          <div>
            <h2>Upcoming Services</h2>
            <p>White Glove watches your garage and prompts the next useful request before it becomes a problem.</p>
          </div>
          <button type="button" onClick={() => setActiveTab("schedule")}>Schedule</button>
        </div>
        {serviceReminders.length === 0 ? (
          <div className="empty-state compact-empty">
            <CalendarCheck size={24} />
            <h3>No reminders due yet</h3>
            <p>Add service timing, tire age, battery age, and detail notes in your garage to activate smarter reminders.</p>
          </div>
        ) : (
          <div className="service-reminder-list">
            {serviceReminders.slice(0, 3).map((reminder) => (
              <article key={reminder.id}>
                <span>{reminder.urgency}</span>
                <div>
                  <h3>{reminder.title}</h3>
                  <p>{reminder.message}</p>
                </div>
                <button type="button" onClick={() => sendReminderRequest(reminder)}>Send Request</button>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="app-section">
        <div className="app-section-title">
          <div>
            <h2>Services</h2>
            <p>Every membership is built around clear concierge categories. Select a service when you are ready to book.</p>
          </div>
          <button type="button" onClick={() => setActiveTab("schedule")}>Book</button>
        </div>
        <div className="service-category-grid">
          {services.map(({ icon: Icon, items, title }) => (
            <button key={title} type="button" onClick={() => setActiveTab("schedule")}>
              <Icon size={20} />
              <span>{title}</span>
              <small>{items.slice(0, 3).join(" / ")}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="app-metrics">
        <article>
          <CalendarCheck size={22} />
          <strong>{serviceReminders.length}</strong>
          <span>Upcoming reminders</span>
        </article>
        <article>
          <Clock size={22} />
          <strong>{appointments.length}</strong>
          <span>Open requests</span>
        </article>
        <article>
          <ShieldCheck size={22} />
          <strong>{getAvailableServices(member.plan).length}</strong>
          <span>Package services</span>
        </article>
      </section>

      {appointments.length > 0 && (
        <section className="app-section">
          <div className="app-section-title">
            <h2>Recent Requests</h2>
            <button type="button" onClick={() => setActiveTab("schedule")}>View all</button>
          </div>
          {appointments.slice(0, 3).map((appointment) => (
            <ServiceRequestCard appointment={appointment} key={appointment.id} />
          ))}
        </section>
      )}
    </div>
  );
}

function GarageScreen({ appointments, garage, member, onAddAppointment, onAddVehicle, onDeleteVehicle, onUpdateVehicle, onComplete }) {
  const garageList = ensureList(garage);
  const serviceReminders = useMemo(() => buildServiceReminders(garageList, member.plan), [garageList, member.plan]);
  const canAddVehicle = canAddGarageVehicle(member.plan, garageList.length);
  const vehicleLimitText = garageLimitLabel(member.plan);
  const [showForm, setShowForm] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const selectedVehicle = garageList.find((vehicle) => vehicle.id === selectedVehicleId);

  useEffect(() => {
    if (!canAddVehicle && showForm) {
      setShowForm(false);
    }
  }, [canAddVehicle, showForm]);

  async function sendReminderRequest(reminder) {
    const savedRequest = await onAddAppointment({
      vehicle: reminder.vehicle,
      service: reminder.service,
      date: "",
      time: "",
      notes: `${reminder.title}. ${reminder.message}`,
    });

    onComplete?.({
      actionLabel: "View Requests",
      actionTab: "schedule",
      details: [
        ["Service", savedRequest?.service || reminder.service],
        ["Vehicle", savedRequest?.vehicle || reminder.vehicle],
        ["Status", savedRequest?.status || "Requested"],
      ],
      message: "Your concierge request has been sent from the garage reminder. White Glove will coordinate the appointment details.",
      secondaryLabel: "Back to Garage",
      secondaryTab: "garage",
      title: "Service request successfully sent.",
    });
  }

  if (selectedVehicle) {
    return (
      <VehicleDetailScreen
        onBack={() => setSelectedVehicleId("")}
        appointments={appointments}
        onComplete={onComplete}
        onDeleteVehicle={onDeleteVehicle}
        onGetOffer={onAddAppointment}
        onUpdateVehicle={onUpdateVehicle}
        vehicle={selectedVehicle}
      />
    );
  }

  return (
    <div className="app-stack">
      <section className="app-section">
        <div className="app-section-title">
          <div>
            <h2>Your Cars</h2>
            <p>Select a vehicle to see market value, prior services, photos, horsepower, notes, and offer requests. Your package allows {vehicleLimitText.toLowerCase()}.</p>
          </div>
          {canAddVehicle && (
            <button className="button primary compact-button" type="button" onClick={() => setShowForm((open) => !open)}>
              <Plus size={18} /> Add Car
            </button>
          )}
        </div>
        {!canAddVehicle && (
          <div className="package-limit-note">
            Your {member.plan} package includes {vehicleLimitText.toLowerCase()}. Upgrade to Collector to upload and manage multiple cars.
          </div>
        )}
        {showForm && canAddVehicle && <VehicleForm onAddVehicle={onAddVehicle} onClose={() => setShowForm(false)} onComplete={onComplete} />}
        {!showForm && garageList.length === 0 && (
          <div className="empty-state">
            <Car size={26} />
            <h3>No vehicles in your garage yet</h3>
            <p>Add your first car to track market value, horsepower, photos, work history, and offer requests.</p>
            {canAddVehicle && (
              <button className="button primary compact-button" type="button" onClick={() => setShowForm(true)}>
                <Plus size={18} /> Add First Car
              </button>
            )}
          </div>
        )}
        <div className="garage-list">
          {garageList.map((vehicle, index) => (
            <VehicleCard key={vehicle.id || `${vehicle.make}-${vehicle.model}-${index}`} onSelect={() => setSelectedVehicleId(vehicle.id)} vehicle={vehicle} />
          ))}
        </div>
      </section>

      <section className="app-section">
        <div className="app-section-title">
          <div>
            <h2>Recommended Next</h2>
            <p>These prompts come from each vehicle's service timing, status, battery age, tire age, and care profile.</p>
          </div>
          <span>{serviceReminders.length} reminders</span>
        </div>
        {serviceReminders.length === 0 ? (
          <div className="empty-state compact-empty">
            <Clock size={24} />
            <h3>No service reminders yet</h3>
            <p>Add next service timing or vehicle condition details in Garage to activate reminders.</p>
          </div>
        ) : (
          <div className="service-reminder-list">
            {serviceReminders.map((reminder) => (
              <article key={reminder.id}>
                <span>{reminder.urgency}</span>
                <div>
                  <h3>{reminder.title}</h3>
                  <p>{reminder.message}</p>
                </div>
                <button type="button" onClick={() => sendReminderRequest(reminder)}>Send Request</button>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ScheduleScreen({ appointments, garage, member, onAddAppointment, onComplete, setActiveTab, vehicleOptions }) {
  const includedServices = useMemo(() => getAvailableServices(member.plan), [member.plan]);
  const serviceReminders = useMemo(() => buildServiceReminders(garage, member.plan), [garage, member.plan]);
  const [selectedService, setSelectedService] = useState(includedServices[0]?.label || "");
  const [selectedServiceOption, setSelectedServiceOption] = useState(serviceOptionsForBooking(includedServices[0]?.label)[0] || "Not Sure");
  const [selectedVehicleId, setSelectedVehicleId] = useState(garage[0]?.id || "");
  const selectedVehicle = garage.find((vehicle) => vehicle.id === selectedVehicleId) || garage[0] || null;
  const formSectionRef = useRef(null);
  const vehicleSectionRef = useRef(null);

  useEffect(() => {
    if (!includedServices.some((service) => service.label === selectedService)) {
      setSelectedService(includedServices[0]?.label || "");
    }
  }, [includedServices, selectedService]);

  useEffect(() => {
    if (!garage.length) {
      setSelectedVehicleId("");
      return;
    }
    if (!garage.some((vehicle) => vehicle.id === selectedVehicleId)) {
      setSelectedVehicleId(garage[0]?.id || "");
    }
  }, [garage, selectedVehicleId]);

  useEffect(() => {
    const options = serviceOptionsForBooking(selectedService);
    if (!options.includes(selectedServiceOption)) {
      setSelectedServiceOption(options[0] || "Not Sure");
    }
  }, [selectedService, selectedServiceOption]);

  function chooseService(serviceLabel) {
    if (!canBookService(member.plan, serviceLabel)) return;
    setSelectedService(serviceLabel);
    setSelectedServiceOption(serviceOptionsForBooking(serviceLabel)[0] || "Not Sure");
    window.requestAnimationFrame(() => {
      formSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  async function sendReminderRequest(reminder) {
    const savedRequest = await onAddAppointment({
      vehicle: reminder.vehicle,
      service: reminder.service,
      date: "",
      time: "",
      notes: `${reminder.title}. ${reminder.message}`,
    });

    onComplete?.({
      actionLabel: "View Requests",
      actionTab: "schedule",
      details: [
        ["Service", savedRequest?.service || reminder.service],
        ["Vehicle", savedRequest?.vehicle || reminder.vehicle],
        ["Status", savedRequest?.status || "Requested"],
      ],
      message: "The reminder was turned into a concierge request. White Glove will follow up with timing and next steps.",
      secondaryLabel: "Back Home",
      secondaryTab: "home",
      title: "Service reminder request sent.",
    });
  }

  return (
    <div className="app-stack">
      <section className="app-section" ref={vehicleSectionRef}>
        <div className="app-section-title">
          <div>
            <h2>Select Your Vehicle</h2>
            <p>Choose one saved Garage vehicle. We use its saved information for pricing, service history, VIN, mileage, and concierge coordination.</p>
          </div>
          <button type="button" onClick={() => setActiveTab("garage")}>Add Vehicle</button>
        </div>
        <SavedVehicleSelector
          vehicles={garage}
          selectedVehicleId={selectedVehicle?.id || ""}
          onVehicleSelect={setSelectedVehicleId}
        />
      </section>

      <section className="app-section">
        <div className="app-section-title">
          <div>
            <h2>Book A Service</h2>
            <p>Select a service after choosing a saved vehicle. Included services are ready to book; locked services show which package unlocks them.</p>
          </div>
          <span>{serviceOptions.length} services</span>
        </div>
        {serviceReminders.length > 0 && (
          <div className="booking-reminder-strip">
            {serviceReminders.slice(0, 2).map((reminder) => (
              <button key={reminder.id} type="button" onClick={() => chooseService(reminder.service)}>
                <span>{reminder.urgency}</span>
                <strong>{reminder.title}</strong>
                <small>{reminder.vehicle}</small>
              </button>
            ))}
          </div>
        )}
        <div className="schedule-service-grid">
          {serviceOptions.map((service) => {
            const selected = selectedService === service.label;
            const included = service.allowedPlans.includes(member.plan);
            return (
              <button
                className={`${selected ? "selected-service" : ""} ${included ? "" : "locked-schedule-service"}`.trim()}
                disabled={!included}
                key={service.label}
                type="button"
                onClick={() => chooseService(service.label)}
                aria-label={included ? `Schedule ${service.label}` : `${service.label} requires ${service.allowedPlans[0]} package`}
              >
                <span className="schedule-service-icon">
                  {included ? selected ? <Check size={24} /> : <CalendarCheck size={24} /> : <ShieldCheck size={24} />}
                </span>
                <div>
                  <h3>{service.label}</h3>
                  <p>{included ? "Included in your package. Tap to book." : `Requires ${service.allowedPlans[0]} or higher.`}</p>
                </div>
                <span className="schedule-service-cta">{included ? selected ? "Selected" : "Book" : "Locked"}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="app-section" ref={formSectionRef}>
        <div className="app-section-title">
          <div>
            <h2>Appointment Details</h2>
            <p>{selectedVehicle ? `${vehicleLabel(selectedVehicle)} is selected. Choose the service option, timing, and notes.` : "Add a vehicle in your Garage before booking."}</p>
          </div>
        </div>
        <ScheduleForm
          garage={garage}
          member={member}
          onAddAppointment={onAddAppointment}
          onComplete={onComplete}
          onChangeVehicle={() => vehicleSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
          selectedService={selectedService}
          selectedServiceOption={selectedServiceOption}
          selectedVehicle={selectedVehicle}
          setSelectedService={setSelectedService}
          setSelectedServiceOption={setSelectedServiceOption}
        />
      </section>
      <section className="app-section">
        <div className="app-section-title">
          <h2>Current Bookings</h2>
          <span>{appointments.length} total</span>
        </div>
        {appointments.map((appointment) => (
          <ServiceRequestCard appointment={appointment} key={appointment.id} />
        ))}
      </section>
    </div>
  );
}

function ServicesScreen({ member, setActiveTab }) {
  return (
    <div className="app-stack">
      <section className="app-section">
        <h2>Services You Can Book</h2>
        <p>Your {member.plan} package includes the services marked available below.</p>
        <div className="app-service-list">
          {services.map(({ icon: Icon, title, items }) => (
            <article key={title}>
              <Icon size={22} />
              <div>
                <h3>{title}</h3>
                <p>{items.slice(0, 3).join(", ")}</p>
              </div>
              <button type="button" onClick={() => setActiveTab("schedule")} aria-label={`Schedule ${title}`}>
                <ChevronRight size={20} />
              </button>
            </article>
          ))}
        </div>
      </section>
      <section className="app-section">
        <div className="app-section-title">
          <div>
            <h2>Package Access</h2>
            <p>{member.plan} members can request these services now.</p>
          </div>
        </div>
        <div className="app-service-list">
          {serviceOptions.map((service) => {
            const included = service.allowedPlans.includes(member.plan);
            return (
              <article className={included ? "" : "locked-service"} key={service.label}>
                {included ? <Check size={22} /> : <ShieldCheck size={22} />}
                <div>
                  <h3>{service.label}</h3>
                  <p>{included ? "Included in your package" : `Requires ${service.allowedPlans[0]} or higher`}</p>
                </div>
                <button disabled={!included} type="button" onClick={() => setActiveTab("schedule")} aria-label={`Schedule ${service.label}`}>
                  <ChevronRight size={20} />
                </button>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function SavedVehicleSelector({ onVehicleSelect, selectedVehicleId, vehicles }) {
  if (!vehicles.length) {
    return (
      <div className="empty-state compact-empty">
        <Car size={24} />
        <h3>No vehicle found in your Garage</h3>
        <p>Add a vehicle before booking this service. The booking flow will use saved Garage details instead of asking you to re-enter them.</p>
      </div>
    );
  }

  return (
    <div className="saved-vehicle-selector">
      {vehicles.map((vehicle, index) => {
        const selected = selectedVehicleId === vehicle.id;
        const label = vehicleLabel(vehicle);
        return (
          <button
            className={selected ? "selected-vehicle-card" : ""}
            key={vehicle.id || `${label}-${index}`}
            type="button"
            onClick={() => onVehicleSelect(vehicle.id)}
          >
            <img alt={label} src={vehicle.image || fallbackVehicleImage} />
            <div>
              <span>{selected ? "Selected vehicle" : "Saved Garage vehicle"}</span>
              <h3>{label}</h3>
              <p>{vehicleMeta(vehicle)}</p>
            </div>
            {selected ? <Check size={22} /> : <ChevronRight size={22} />}
          </button>
        );
      })}
    </div>
  );
}

function FeedScreen({ feedPosts, member, onAddFeedPost, onComplete, onRefreshFeedPosts, vehicleOptions }) {
  const [feedNotice, setFeedNotice] = useState("");
  const [refreshingFeed, setRefreshingFeed] = useState(false);

  async function refreshFeed() {
    setFeedNotice("");
    setRefreshingFeed(true);
    try {
      await onRefreshFeedPosts?.();
    } catch (error) {
      setFeedNotice(error.message || "Could not refresh the member feed.");
    } finally {
      setRefreshingFeed(false);
    }
  }

  return (
    <div className="app-stack">
      <section className="app-section">
        <div className="app-section-title">
          <div>
            <h2>Member Feed</h2>
            <p>Share vehicle photos, service updates, detail results, delivery moments, and collection highlights with every member.</p>
          </div>
          <button type="button" onClick={refreshFeed} disabled={refreshingFeed}>
            {refreshingFeed ? "Refreshing" : `${feedPosts.length} posts`}
          </button>
        </div>
        {feedNotice && (
          <div className="error-message" role="alert">
            {feedNotice}
          </div>
        )}
        <FeedUploadForm onAddFeedPost={onAddFeedPost} onComplete={onComplete} vehicleOptions={vehicleOptions} />
      </section>

      <section className="app-section">
        <div className="app-section-title">
          <div>
            <h2>Garage Feed</h2>
            <p>All member posts appear here so the community can see each other&apos;s vehicles and updates.</p>
          </div>
        </div>
        {feedPosts.length === 0 ? (
          <div className="empty-state">
            <Upload size={26} />
            <h3>No feed posts yet</h3>
            <p>Upload the first car photo from this Feed screen.</p>
          </div>
        ) : (
          <div className="feed-grid">
            {feedPosts.map((post) => (
              <article key={post.id}>
                <img alt={post.caption || "Vehicle feed post"} src={post.image} />
                <div>
                  <span>{post.vehicle || "Garage update"}</span>
                  <h3>{post.caption || "White Glove member post"}</h3>
                  <p>{post.author || "Member"} · {formatPostDate(post.createdAt)}</p>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function FeedUploadForm({ onAddFeedPost, onComplete, vehicleOptions }) {
  const [imagePreview, setImagePreview] = useState("");
  const [feedError, setFeedError] = useState("");

  function handleImage(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result);
    reader.readAsDataURL(file);
  }

  async function submitFeedPost(event) {
    event.preventDefault();
    setFeedError("");

    if (!imagePreview) {
      setFeedError("Upload a photo before posting to the feed.");
      return;
    }

    const form = event.currentTarget;
    const formData = new FormData(form);

    try {
      const savedPost = await onAddFeedPost({
        caption: formData.get("caption"),
        image: imagePreview,
        vehicle: formData.get("vehicle"),
      });

      form.reset();
      setImagePreview("");
      onComplete?.({
        actionLabel: "View Feed",
        actionTab: "feed",
        details: [
          ["Vehicle", savedPost.vehicle || "Garage update"],
          ["Post", savedPost.caption || "Photo uploaded"],
          ["Status", "Posted"],
        ],
        message: "Your photo has been added to the member feed.",
        secondaryLabel: "Back Home",
        secondaryTab: "home",
        title: "Feed post successfully updated.",
      });
    } catch (error) {
      setFeedError(error.message || "Could not upload this feed post.");
    }
  }

  return (
    <form className="app-form inline-form feed-upload-form" onSubmit={submitFeedPost}>
      {feedError && (
        <div className="error-message" role="alert">
          {feedError}
        </div>
      )}
      <label className="upload-tile feed-upload-tile">
        {imagePreview ? <img alt="Feed preview" src={imagePreview} /> : <><Upload size={24} /><span>Upload feed photo</span></>}
        <input accept="image/*" name="photo" onChange={handleImage} type="file" />
      </label>
      <div className="app-form-grid">
        <label>
          Vehicle
          <select name="vehicle">
            <option value="">Garage update</option>
            {vehicleOptions.map((vehicle) => (
              <option key={vehicle} value={vehicle}>{vehicle}</option>
            ))}
          </select>
        </label>
        <label>
          Caption
          <input name="caption" type="text" placeholder="Fresh detail, delivery day, service update..." />
        </label>
      </div>
      <button className="button primary submit" type="submit">Post To Feed</button>
    </form>
  );
}

function ProfileAvatar({ member, size = 32 }) {
  const avatarUrl = member?.avatarUrl;
  const style = { "--profile-avatar-size": `${size}px` };

  return (
    <span className={avatarUrl ? "profile-avatar has-photo" : "profile-avatar"} style={style}>
      {avatarUrl ? <img alt={`${member?.name || "Member"} profile`} src={avatarUrl} /> : <User size={Math.max(18, Math.round(size * 0.58))} />}
    </span>
  );
}

function AccountScreen({ garageCount, member, onLogout, onUpdateMember }) {
  const includedServices = getAvailableServices(member.plan);
  const [avatarPreview, setAvatarPreview] = useState(member.avatarUrl || "");
  const [settingsError, setSettingsError] = useState("");
  const [settingsNotice, setSettingsNotice] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);
  const notifications = {
    ...defaultNotificationSettings,
    ...(member.notifications || {}),
  };

  function handleAvatarUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => setAvatarPreview(reader.result);
    reader.readAsDataURL(file);
  }

  async function submitSettings(event) {
    event.preventDefault();
    setSettingsError("");
    setSettingsNotice("");
    setSavingSettings(true);

    const formData = new FormData(event.currentTarget);
    const nextNotifications = {
      bookingUpdates: formData.has("bookingUpdates"),
      feedActivity: formData.has("feedActivity"),
      offers: formData.has("offers"),
      serviceReminders: formData.has("serviceReminders"),
    };

    try {
      await onUpdateMember({
        avatarUrl: avatarPreview,
        name: formData.get("name"),
        username: formData.get("username"),
        plan: formData.get("plan"),
        notifications: nextNotifications,
        password: formData.get("password"),
      });
      event.currentTarget.password.value = "";
      setSettingsNotice("Profile settings successfully updated.");
    } catch (error) {
      setSettingsError(error.message || "Could not update profile settings.");
    } finally {
      setSavingSettings(false);
    }
  }

  return (
    <div className="app-stack">
      <section className="app-section account-settings-panel">
        <div className="account-settings-header">
          <div className="account-avatar">
            <ProfileAvatar member={{ ...member, avatarUrl: avatarPreview }} size={76} />
          </div>
          <div>
            <p className="eyebrow">Profile Settings</p>
            <h2>{member.name}</h2>
            <p>{member.email}</p>
            <span>{member.plan} membership</span>
          </div>
        </div>

        <form className="settings-form" onSubmit={submitSettings}>
          {settingsError && <div className="form-alert">{settingsError}</div>}
          {settingsNotice && <div className="success-alert">{settingsNotice}</div>}
          <label className="profile-photo-field">
            <span>Profile picture</span>
            <div>
              <ProfileAvatar member={{ ...member, avatarUrl: avatarPreview }} size={54} />
              <input accept="image/*" type="file" onChange={handleAvatarUpload} />
            </div>
          </label>
          <div className="app-form-grid">
            <label>
              Full name
              <input name="name" type="text" defaultValue={member.name || ""} required />
            </label>
            <label>
              Username
              <input name="username" type="text" defaultValue={member.username || ""} placeholder="preferred member name" />
            </label>
            <label>
              Email
              <input type="email" value={member.email || ""} readOnly />
            </label>
            <label>
              Package
              <select name="plan" defaultValue={member.plan || "Club Drive"}>
                {plans.map((plan) => (
                  <option key={plan.name} value={plan.name}>{plan.name}</option>
                ))}
              </select>
            </label>
            <label>
              New password
              <input name="password" type="password" minLength="6" placeholder="Leave blank to keep current password" />
            </label>
            <label>
              Garage access
              <input type="text" value={hasCollectionPackage(member.plan) ? `${garageCount} vehicles saved · ${garageLimitLabel(member.plan)}` : `${garageCount}/1 vehicle used`} readOnly />
            </label>
          </div>

          <fieldset className="notification-settings">
            <legend>Notifications</legend>
            <label>
              <input name="serviceReminders" type="checkbox" defaultChecked={notifications.serviceReminders} />
              Service reminders
            </label>
            <label>
              <input name="bookingUpdates" type="checkbox" defaultChecked={notifications.bookingUpdates} />
              Booking updates
            </label>
            <label>
              <input name="feedActivity" type="checkbox" defaultChecked={notifications.feedActivity} />
              Feed activity
            </label>
            <label>
              <input name="offers" type="checkbox" defaultChecked={notifications.offers} />
              Vehicle offers
            </label>
          </fieldset>

          <div className="settings-actions">
            <button className="button primary" type="submit" disabled={savingSettings}>
              {savingSettings ? "Saving..." : "Save Settings"}
            </button>
            <button className="button secondary" type="button" onClick={onLogout}>
              <LogOut size={18} /> Log out
            </button>
          </div>
        </form>
      </section>
      <section className="app-section">
        <h2>Included In Your Package</h2>
        <ul className="next-list">
          {includedServices.map((service) => (
            <li key={service.label}>{service.label}</li>
          ))}
        </ul>
      </section>
      <section className="app-section">
        <h2>Account Status</h2>
        <ul className="next-list">
          <li>Secure login active</li>
          <li>Garage records saved to your account</li>
          <li>Vehicle photos saved to private member storage</li>
          <li>Service and offer requests saved for concierge review</li>
        </ul>
      </section>
    </div>
  );
}

function VehicleForm({ onAddVehicle, onClose, onComplete }) {
  const [imagePreview, setImagePreview] = useState("");
  const [vehicleError, setVehicleError] = useState("");

  function handleImage(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result);
    reader.readAsDataURL(file);
  }

  async function submitVehicle(event) {
    event.preventDefault();
    setVehicleError("");
    const formData = new FormData(event.currentTarget);
    const ownershipNotes = [
      formData.get("notes"),
      formData.get("vin") && `VIN: ${formData.get("vin")}`,
      formData.get("location") && `Location: ${formData.get("location")}`,
      formData.get("insurance") && `Insurance: ${formData.get("insurance")}`,
      formData.get("warranty") && `Warranty: ${formData.get("warranty")}`,
      formData.get("preferredDealer") && `Preferred dealership: ${formData.get("preferredDealer")}`,
      formData.get("pickupLocation") && `Preferred pickup: ${formData.get("pickupLocation")}`,
      formData.get("nextService") && `Next service: ${formData.get("nextService")}`,
      formData.get("lastOilChange") && `Last oil change: ${formData.get("lastOilChange")}`,
      formData.get("lastDetail") && `Last detail: ${formData.get("lastDetail")}`,
      formData.get("brakeService") && `Brake service: ${formData.get("brakeService")}`,
      formData.get("recallStatus") && `Recall status: ${formData.get("recallStatus")}`,
      formData.get("serviceInterval") && `Service interval: ${formData.get("serviceInterval")}`,
      formData.get("tireSeason") && `Tire season: ${formData.get("tireSeason")}`,
      formData.get("color") && `Color: ${formData.get("color")}`,
      formData.get("plate") && `Plate: ${formData.get("plate")}`,
      formData.get("condition") && `Condition: ${formData.get("condition")}`,
      formData.get("storageNeeds") && `Storage needs: ${formData.get("storageNeeds")}`,
      formData.get("tireAge") && `Tire age: ${formData.get("tireAge")}`,
      formData.get("batteryAge") && `Battery age: ${formData.get("batteryAge")}`,
      formData.get("registration") && `Registration: ${formData.get("registration")}`,
    ].filter(Boolean).join("\n");

    try {
      const savedVehicle = await onAddVehicle({
        year: formData.get("year"),
        make: formData.get("make"),
        model: formData.get("model"),
        mileage: formData.get("mileage"),
        use: formData.get("use"),
        vin: formData.get("vin"),
        location: formData.get("location"),
        insurance: formData.get("insurance"),
        warranty: formData.get("warranty"),
        preferredDealer: formData.get("preferredDealer"),
        pickupLocation: formData.get("pickupLocation"),
        nextService: formData.get("nextService"),
        lastOilChange: formData.get("lastOilChange"),
        lastDetail: formData.get("lastDetail"),
        brakeService: formData.get("brakeService"),
        recallStatus: formData.get("recallStatus"),
        serviceInterval: formData.get("serviceInterval"),
        tireSeason: formData.get("tireSeason"),
        color: formData.get("color"),
        plate: formData.get("plate"),
        condition: formData.get("condition"),
        storageNeeds: formData.get("storageNeeds"),
        tireAge: formData.get("tireAge"),
        batteryAge: formData.get("batteryAge"),
        registration: formData.get("registration"),
        notes: ownershipNotes,
        marketValue: formData.get("marketValue") || estimateMarketValue({
          year: formData.get("year"),
          make: formData.get("make"),
          model: formData.get("model"),
          mileage: formData.get("mileage"),
        }),
        horsepower: formData.get("horsepower") || "HP pending",
        workDone: splitWorkList(formData.get("workDone")),
        image: imagePreview || "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=900&q=85",
      });
      event.currentTarget.reset();
      setImagePreview("");
      onClose();
      onComplete?.({
        actionLabel: "View Garage",
        actionTab: "garage",
        details: [
          ["Vehicle", `${savedVehicle?.year || formData.get("year")} ${savedVehicle?.make || formData.get("make")} ${savedVehicle?.model || formData.get("model")}`.trim()],
          ["Market value", savedVehicle?.marketValue || formData.get("marketValue") || vehicleMarketValue(savedVehicle || {})],
          ["Status", savedVehicle?.status || "New vehicle added"],
        ],
        message: "Your garage has been updated. White Glove can now track this vehicle, its records, service needs, market value, and offer requests.",
        secondaryLabel: "Schedule Service",
        secondaryTab: "schedule",
        title: "Vehicle listing successfully updated.",
      });
    } catch (error) {
      setVehicleError(error.message || "Could not save this vehicle.");
    }
  }

  return (
    <form className="app-form inline-form" onSubmit={submitVehicle}>
      {vehicleError && (
        <div className="error-message" role="alert">
          {vehicleError}
        </div>
      )}
      <label className="upload-tile">
        {imagePreview ? <img alt="Vehicle preview" src={imagePreview} /> : <><Upload size={24} /><span>Upload vehicle photo</span></>}
        <input accept="image/*" name="photo" onChange={handleImage} type="file" />
      </label>
      <div className="app-form-grid">
        <label>
          Year
          <input name="year" required type="number" placeholder="2024" />
        </label>
        <label>
          Make
          <input name="make" required type="text" placeholder="Porsche" />
        </label>
        <label>
          Model
          <input name="model" required type="text" placeholder="911" />
        </label>
        <label>
          Mileage
          <input name="mileage" type="text" placeholder="12,500" />
        </label>
        <label>
          VIN
          <input name="vin" type="text" placeholder="WP0AB2A9..." />
        </label>
        <label>
          License plate
          <input name="plate" type="text" placeholder="ABC 123" />
        </label>
        <label>
          Color
          <input name="color" type="text" placeholder="Guards Red" />
        </label>
        <label>
          Vehicle location
          <input name="location" type="text" placeholder="Montreal, QC" />
        </label>
        <label>
          Current market value
          <input name="marketValue" type="text" placeholder="$85,000" />
        </label>
        <label>
          Horsepower
          <input name="horsepower" type="text" placeholder="503 hp" />
        </label>
        <label>
          Use
          <select name="use">
            <option>Seasonal</option>
            <option>Daily</option>
            <option>Collection</option>
            <option>Track</option>
          </select>
        </label>
        <label>
          Insurance
          <input name="insurance" type="text" placeholder="Provider or policy notes" />
        </label>
        <label>
          Warranty
          <input name="warranty" type="text" placeholder="Factory, extended, or none" />
        </label>
        <label>
          Preferred dealership
          <input name="preferredDealer" type="text" placeholder="Dealer or shop preference" />
        </label>
        <label>
          Preferred pickup location
          <input name="pickupLocation" type="text" placeholder="Home, office, storage facility" />
        </label>
        <label>
          Condition
          <select name="condition">
            <option>Excellent</option>
            <option>Good</option>
            <option>Needs attention</option>
            <option>Not running</option>
          </select>
        </label>
        <label>
          Next service
          <input name="nextService" type="text" placeholder="Oil change in 42 days" />
        </label>
        <label>
          Last oil change
          <input name="lastOilChange" type="text" placeholder="May 2026 or 8,000 km ago" />
        </label>
        <label>
          Service interval
          <input name="serviceInterval" type="text" placeholder="Every 6 months or 8,000 km" />
        </label>
        <label>
          Last detail
          <input name="lastDetail" type="text" placeholder="Spring 2026" />
        </label>
        <label>
          Brake service
          <input name="brakeService" type="text" placeholder="Pads checked June 2026" />
        </label>
        <label>
          Recall status
          <input name="recallStatus" type="text" placeholder="Checked / needs dealer check" />
        </label>
        <label>
          Tire season
          <select name="tireSeason">
            <option>All season</option>
            <option>Summer</option>
            <option>Winter</option>
            <option>Track</option>
            <option>Not sure</option>
          </select>
        </label>
        <label>
          Tire age
          <input name="tireAge" type="text" placeholder="2 years" />
        </label>
        <label>
          Battery age
          <input name="batteryAge" type="text" placeholder="18 months" />
        </label>
        <label>
          Registration
          <input name="registration" type="text" placeholder="Active or renewal date" />
        </label>
      </div>
      <label>
        Storage needs
        <textarea name="storageNeeds" rows="2" placeholder="Indoor storage, battery tender, climate control, monthly start, fuel stabilizer..." />
      </label>
      <label>
        What has been done to the car?
        <textarea name="workDone" rows="3" placeholder="Ceramic coating, exhaust, wheels, tune, wrap..." />
      </label>
      <label>
        Notes
        <textarea name="notes" rows="3" placeholder="Storage needs, preferred services, modifications, or special care notes." />
      </label>
      <button className="button primary submit" type="submit">Save Vehicle</button>
    </form>
  );
}

function ScheduleForm({ garage, member, onAddAppointment, onChangeVehicle, onComplete, selectedService, selectedServiceOption, selectedVehicle, setSelectedService, setSelectedServiceOption }) {
  const [bookingStep, setBookingStep] = useState("details");
  const [pendingBooking, setPendingBooking] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState("card-on-file");
  const [currentLocation, setCurrentLocation] = useState(selectedVehicle?.pickupLocation || selectedVehicle?.location || "");
  const [transportChoice, setTransportChoice] = useState("self-dropoff");
  const [warrantyCoverage, setWarrantyCoverage] = useState("not-warranty");
  const [processingPayment, setProcessingPayment] = useState(false);
  const [requestError, setRequestError] = useState("");
  const availableServices = getAvailableServices(member.plan);
  const serviceSubOptions = serviceOptionsForBooking(selectedService);
  const serviceQuestions = serviceQuestionsForBooking(selectedService);
  const hasVehicles = garage.length > 0 && Boolean(selectedVehicle);
  const basePaymentTerms = paymentTermsForService(selectedService, selectedVehicle, selectedServiceOption);
  const selectedTransportChoice = transportChoices.find((choice) => choice.value === transportChoice) || transportChoices[0];
  const selectedPaymentTerms = bookingPaymentTerms(basePaymentTerms, selectedTransportChoice, warrantyCoverage);
  const selectedVehicleClass = vehicleClassFromVehicle(selectedVehicle);

  useEffect(() => {
    setBookingStep("details");
    setPendingBooking(null);
    setRequestError("");
    setCurrentLocation(selectedVehicle?.pickupLocation || selectedVehicle?.location || "");
  }, [selectedService, selectedServiceOption, selectedVehicle?.id]);

  async function submitAppointment(event) {
    event.preventDefault();
    setRequestError("");

    const formData = new FormData(event.currentTarget);
    const appointment = {
      vehicle: selectedVehicle ? vehicleLabel(selectedVehicle) : "",
      vehicleId: selectedVehicle?.id || "",
      vehicleClass: selectedVehicleClass,
      service: formData.get("service"),
      serviceOption: formData.get("serviceOption"),
      date: formData.get("date"),
      time: formData.get("time"),
      notes: [
        `Vehicle ID: ${selectedVehicle?.id || "not selected"}`,
        `Vehicle class: ${selectedVehicleClass}`,
        `Service option: ${formData.get("serviceOption")}`,
        `Current vehicle location: ${formData.get("currentLocation")}`,
        `Drop-off / pickup: ${selectedPaymentTerms.transportLabel}`,
        `Transportation direction: ${selectedPaymentTerms.transportDirection}`,
        `Transportation charge: ${selectedPaymentTerms.transportAmount}`,
        `Warranty: ${selectedPaymentTerms.warrantyLabel}`,
        formData.get("notes"),
        `Payment: ${selectedPaymentTerms.title} - ${selectedPaymentTerms.amount}. ${selectedPaymentTerms.note}`,
      ].filter(Boolean).join("\n\n"),
      paymentAmount: selectedPaymentTerms.amount,
      paymentMode: selectedPaymentTerms.mode,
      paymentNote: selectedPaymentTerms.note,
      paymentTitle: selectedPaymentTerms.title,
      currentLocation: formData.get("currentLocation"),
    };

    try {
      if (!hasVehicles) {
        throw new Error("Add a vehicle to your garage before requesting service.");
      }

      if (!canBookService(member.plan, appointment.service)) {
        throw new Error(`${appointment.service} is not included in your ${member.plan} package.`);
      }

      setPendingBooking({
        appointment,
        formData: {
          "form-name": "service-request",
          memberName: member.name,
          memberEmail: member.email,
          vehicle: appointment.vehicle,
          vehicleId: appointment.vehicleId,
          vehicleClass: appointment.vehicleClass,
          service: appointment.service,
          serviceOption: appointment.serviceOption,
          currentLocation: appointment.currentLocation,
          date: appointment.date,
          time: appointment.time,
          paymentMode: selectedPaymentTerms.mode,
          paymentTitle: selectedPaymentTerms.title,
          paymentAmount: selectedPaymentTerms.amount,
          paymentAmountCents: selectedPaymentTerms.amountCents,
          paymentNote: selectedPaymentTerms.note,
          transportAmount: selectedPaymentTerms.transportAmount,
          transportChoice,
          transportDirection: selectedPaymentTerms.transportDirection,
          warrantyCoverage,
          warrantyLabel: selectedPaymentTerms.warrantyLabel,
          notes: appointment.notes,
        },
      });
      setBookingStep("payment");
    } catch (error) {
      setRequestError(error.message || "We could not prepare that booking. Please try again or contact the concierge directly.");
    }
  }

  async function confirmPayment(event) {
    event.preventDefault();
    setRequestError("");

    if (!pendingBooking?.appointment) {
      setBookingStep("details");
      return;
    }

    const paymentLabel = paymentMethodLabel(paymentMethod);
    const amountCents = paymentAmountCents({ amount: pendingBooking.appointment.paymentAmount, amountCents: pendingBooking.formData.paymentAmountCents });
    const paymentSummary = paymentLabel;
    const appointment = {
      ...pendingBooking.appointment,
      notes: [
        pendingBooking.appointment.notes,
        `Payment method: ${paymentSummary}`,
        `Confirmation email: sent instantly to ${member.email}`,
      ].filter(Boolean).join("\n\n"),
      paymentMethod: paymentSummary,
    };

    const netlifyFormData = {
      ...pendingBooking.formData,
      notes: appointment.notes,
      paymentMethod: paymentSummary,
    };

    try {
      setProcessingPayment(true);

      if (amountCents > 0 && window.location.hostname !== "127.0.0.1" && window.location.hostname !== "localhost") {
        const response = await fetch("/.netlify/functions/create-checkout-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...netlifyFormData,
            amountCents,
            description: `${appointment.serviceOption} for ${appointment.vehicle}`,
            memberEmail: member.email,
            memberName: member.name,
            paymentMethod: paymentSummary,
            serviceLabel: `${appointment.service} - ${appointment.serviceOption}`,
            currentLocation: appointment.currentLocation,
            transportAmount: pendingBooking.formData.transportAmount,
            transportChoice: pendingBooking.formData.transportChoice,
            transportDirection: pendingBooking.formData.transportDirection,
            userId: member.id,
            warrantyCoverage: pendingBooking.formData.warrantyCoverage,
            warrantyLabel: pendingBooking.formData.warrantyLabel,
          }),
        });

        const checkout = await response.json().catch(() => ({}));
        if (!response.ok || !checkout.url) {
          throw new Error(checkout.error || "Could not start secure payment checkout.");
        }

        window.location.assign(checkout.url);
        return;
      }

      if (window.location.hostname !== "127.0.0.1" && window.location.hostname !== "localhost") {
        const response = await fetch("/", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams(netlifyFormData).toString(),
        });

        if (!response.ok) {
          throw new Error("Service request failed");
        }
      }

      const savedRequest = await onAddAppointment(appointment);
      setBookingStep("details");
      setPendingBooking(null);
      onComplete?.({
        actionLabel: "View Requests",
        actionTab: "schedule",
        details: [
          ["Service", savedRequest?.service || appointment.service],
          ["Option", appointment.serviceOption],
          ["Vehicle", savedRequest?.vehicle || appointment.vehicle],
          ["Current location", appointment.currentLocation],
          ["Preferred date", savedRequest?.date || appointment.date || "Date pending"],
          ["Payment", appointment.paymentTitle],
          ["Transport", pendingBooking.formData.transportAmount],
          ["Warranty", pendingBooking.formData.warrantyLabel],
          ["Payment method", paymentSummary],
          ["Email", member.email],
        ],
        message: `Your booking is confirmed. A confirmation email has been sent instantly to ${member.email}.`,
        secondaryLabel: "Back Home",
        secondaryTab: "home",
        title: "Booking confirmed.",
      });
    } catch (error) {
      setRequestError(error.message || "We could not complete that booking. Please try again or contact the concierge directly.");
    } finally {
      setProcessingPayment(false);
    }
  }

  if (bookingStep === "payment" && pendingBooking) {
    const appointment = pendingBooking.appointment;

    return (
      <form className="app-form inline-form payment-checkout" onSubmit={confirmPayment}>
        {requestError && (
          <div className="error-message" role="alert">
            {requestError}
          </div>
        )}
        <div className="checkout-summary">
          <div>
            <p className="eyebrow">Payment</p>
            <h3>Confirm your booking</h3>
            <p>{appointment.service} for {appointment.vehicle}</p>
          </div>
          <div>
            <span>{appointment.paymentTitle}</span>
            <strong>{appointment.paymentAmount}</strong>
          </div>
        </div>
        <div className="payment-method-grid">
          {[
            ["card-on-file", "Card on file", "Use your saved member payment method."],
            ["new-card", "Add credit card", "Use a different card for this booking."],
            ["apple-pay", "Apple Pay", "Confirm with Apple Pay on supported devices."],
          ].map(([value, label, description]) => (
            <label className={paymentMethod === value ? "selected-payment-method" : ""} key={value}>
              <input checked={paymentMethod === value} name="paymentMethod" onChange={() => setPaymentMethod(value)} type="radio" value={value} />
              <CreditCard size={20} />
              <span>{label}</span>
              <small>{description}</small>
            </label>
          ))}
        </div>
        {paymentMethod === "new-card" && (
          <div className="payment-terms full-payment-card">
            <CreditCard size={22} />
            <div>
              <span>Secure checkout</span>
              <h3>Enter card details on Stripe</h3>
              <p>Your card details are entered on Stripe's secure payment page after you confirm this booking.</p>
            </div>
          </div>
        )}
        {paymentMethod === "apple-pay" && (
          <div className="payment-terms full-payment-card">
            <CreditCard size={22} />
            <div>
              <span>Apple Pay selected</span>
              <h3>Ready to confirm</h3>
              <p>Apple Pay appears automatically on Stripe Checkout when it is supported by the device and browser.</p>
            </div>
          </div>
        )}
        <div className="checkout-actions">
          <button className="button secondary" type="button" onClick={() => setBookingStep("details")}>
            Back To Details
          </button>
          <button className="button primary submit" type="submit" disabled={processingPayment}>
            {processingPayment ? "Confirming..." : "Confirm Booking"}
          </button>
        </div>
      </form>
    );
  }

  return (
    <form className="app-form inline-form" onSubmit={submitAppointment}>
      <input type="hidden" name="form-name" value="service-request" />
      <input type="hidden" name="memberName" value={member.name} />
      <input type="hidden" name="memberEmail" value={member.email} />
      <input type="hidden" name="vehicle" value={selectedVehicle ? vehicleLabel(selectedVehicle) : ""} />
      <input type="hidden" name="vehicleId" value={selectedVehicle?.id || ""} />
      <input type="hidden" name="vehicleClass" value={selectedVehicleClass} />
      <input type="hidden" name="paymentMode" value={selectedPaymentTerms.mode} />
      <input type="hidden" name="paymentTitle" value={selectedPaymentTerms.title} />
      <input type="hidden" name="paymentAmount" value={selectedPaymentTerms.amount} />
      <input type="hidden" name="paymentNote" value={selectedPaymentTerms.note} />
      <input type="hidden" name="transportChoice" value={transportChoice} />
      <input type="hidden" name="transportDirection" value={selectedPaymentTerms.transportDirection} />
      <input type="hidden" name="transportAmount" value={selectedPaymentTerms.transportAmount} />
      <input type="hidden" name="warrantyCoverage" value={warrantyCoverage} />
      <input type="hidden" name="warrantyLabel" value={selectedPaymentTerms.warrantyLabel} />
      <label className="hidden-field">
        Do not fill this out
        <input name="bot-field" tabIndex="-1" autoComplete="off" />
      </label>
      {requestError && (
        <div className="error-message" role="alert">
          {requestError}
        </div>
      )}
      {!hasVehicles && (
        <div className="error-message" role="alert">
          Add a vehicle to your garage before requesting service.
        </div>
      )}
      {selectedVehicle && (
        <div className="selected-vehicle-summary">
          <img alt={vehicleLabel(selectedVehicle)} src={selectedVehicle.image || fallbackVehicleImage} />
          <div>
            <span>Your vehicle</span>
            <h3>{vehicleLabel(selectedVehicle)}</h3>
            <p>{vehicleMeta(selectedVehicle)} • {selectedVehicleClass.toUpperCase()}</p>
          </div>
          <button type="button" onClick={onChangeVehicle}>Change vehicle</button>
        </div>
      )}
      <div className="app-form-grid">
        <label>
          Service
          <select name="service" onChange={(event) => setSelectedService(event.target.value)} required value={selectedService}>
            {availableServices.map((service) => (
              <option key={service.label} value={service.label}>{service.label}</option>
            ))}
          </select>
        </label>
        <label>
          Service option
          <select name="serviceOption" onChange={(event) => setSelectedServiceOption(event.target.value)} required value={selectedServiceOption}>
            {serviceSubOptions.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>
        <label>
          Preferred date
          <input name="date" required type="date" />
        </label>
        <label>
          Preferred time
          <input name="time" required type="time" />
        </label>
      </div>
      <AddressAutocomplete
        label="Car's current location"
        name="currentLocation"
        onChange={setCurrentLocation}
        placeholder="Start typing the pickup, home, office, storage, or dealership address"
        required
        value={currentLocation}
      />
      <div className="booking-choice-section">
        <div>
          <span className="eyebrow">Vehicle logistics</span>
          <h3>How should the vehicle get there?</h3>
        </div>
        <div className="booking-choice-grid">
          {transportChoices.map((choice) => (
            <label className={transportChoice === choice.value ? "selected-booking-choice" : ""} key={choice.value}>
              <input checked={transportChoice === choice.value} name="transportChoiceVisible" onChange={() => setTransportChoice(choice.value)} type="radio" value={choice.value} />
              <span>{choice.label}</span>
              <small>{choice.description}</small>
              {choice.amountCents > 0 && <strong>{formatCad(choice.amountCents / 100)}</strong>}
            </label>
          ))}
        </div>
      </div>
      <div className="booking-choice-section">
        <div>
          <span className="eyebrow">Warranty</span>
          <h3>Is this covered by warranty?</h3>
        </div>
        <div className="booking-choice-grid warranty-choice-grid">
          {warrantyChoices.map((choice) => (
            <label className={warrantyCoverage === choice.value ? "selected-booking-choice" : ""} key={choice.value}>
              <input checked={warrantyCoverage === choice.value} name="warrantyCoverageVisible" onChange={() => setWarrantyCoverage(choice.value)} type="radio" value={choice.value} />
              <span>{choice.label}</span>
              <small>{choice.value === "not-warranty" ? "Use normal service pricing." : "Warranty work is free today unless pickup is selected."}</small>
            </label>
          ))}
        </div>
      </div>
      {selectedService && (
        <div className={selectedPaymentTerms.mode === "full" ? "payment-terms full-payment-card" : "payment-terms deposit-payment-card"}>
          <CreditCard size={22} />
          <div>
            <span>{selectedPaymentTerms.mode === "free" ? "Free request" : selectedPaymentTerms.mode === "full" ? "Accurate price service" : "Quote or diagnosis needed"}</span>
            <h3>{selectedPaymentTerms.title}</h3>
            <p>{selectedPaymentTerms.amount}. {selectedPaymentTerms.note}</p>
          </div>
        </div>
      )}
      {serviceQuestions.length > 0 && (
        <div className="service-question-list">
          <span>Details to include</span>
          {serviceQuestions.map((question) => (
            <p key={question}>{question}</p>
          ))}
        </div>
      )}
      <label>
        Notes
        <textarea name="notes" rows="3" placeholder="Tell the concierge what you need handled." />
      </label>
      <button className="button primary submit" type="submit" disabled={!hasVehicles}>Continue To Payment</button>
    </form>
  );
}

function VehicleCard({ onSelect, vehicle }) {
  const label = `${vehicle.year || ""} ${vehicle.make || ""} ${vehicle.model || ""}`.trim() || "Garage vehicle";
  const mileage = vehicle.mileage ? `${vehicle.mileage} miles` : "Mileage pending";
  const marketValue = vehicleMarketValue(vehicle);
  const handleImageError = (event) => {
    event.currentTarget.src = fallbackVehicleImage;
  };

  return (
    <button className="vehicle-card" type="button" onClick={onSelect} disabled={!vehicle.id}>
      <img alt={label} onError={handleImageError} src={vehicle.image || fallbackVehicleImage} />
      <div>
        <span>{vehicle.use || "Collection"}</span>
        <h3>{label}</h3>
        <p>{mileage}</p>
        <strong className="vehicle-value">{marketValue}</strong>
      </div>
      <strong>{vehicle.status || "Active"}</strong>
    </button>
  );
}

function VehicleDetailScreen({ appointments, onBack, onComplete, onDeleteVehicle, onGetOffer, onUpdateVehicle, vehicle }) {
  const [photoPreview, setPhotoPreview] = useState("");
  const [detailError, setDetailError] = useState("");
  const [deletingVehicle, setDeletingVehicle] = useState(false);
  const [offerRequested, setOfferRequested] = useState(false);
  const workHistory = ensureList(vehicle.workDone);
  const workDone = workHistory.length ? workHistory : ["No work logged yet"];
  const vehicleLabel = `${vehicle.year || ""} ${vehicle.make || ""} ${vehicle.model || ""}`.trim() || "Garage vehicle";
  const marketValue = vehicleMarketValue(vehicle);
  const serviceHistory = serviceHistoryForVehicle(vehicle, appointments);
  const trackingItems = vehicleTrackingItems(vehicle);
  const ownershipProfile = [
    ["VIN", vehicle.vin || "Needed"],
    ["Plate", vehicle.plate || "Needed"],
    ["Color", vehicle.color || "Needed"],
    ["Condition", vehicle.condition || "Needed"],
    ["Location", vehicle.location || "Needed"],
    ["Insurance", vehicle.insurance || "Needed"],
    ["Warranty", vehicle.warranty || "Needed"],
    ["Preferred dealership", vehicle.preferredDealer || "Needed"],
    ["Preferred pickup", vehicle.pickupLocation || "Needed"],
    ["Service interval", vehicle.serviceInterval || "Needed"],
    ["Last oil change", vehicle.lastOilChange || "Needed"],
    ["Last detail", vehicle.lastDetail || "Needed"],
    ["Recall status", vehicle.recallStatus || "Needed"],
  ];
  const handleImageError = (event) => {
    event.currentTarget.src = fallbackVehicleImage;
  };

  function handlePhoto(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(reader.result);
    reader.readAsDataURL(file);
  }

  async function saveDetails(event) {
    event.preventDefault();
    setDetailError("");
    const formData = new FormData(event.currentTarget);
    const ownershipNotes = [
      formData.get("notes") || vehicle.notes,
      formData.get("vin") && `VIN: ${formData.get("vin")}`,
      formData.get("plate") && `Plate: ${formData.get("plate")}`,
      formData.get("color") && `Color: ${formData.get("color")}`,
      formData.get("condition") && `Condition: ${formData.get("condition")}`,
      formData.get("location") && `Location: ${formData.get("location")}`,
      formData.get("insurance") && `Insurance: ${formData.get("insurance")}`,
      formData.get("warranty") && `Warranty: ${formData.get("warranty")}`,
      formData.get("preferredDealer") && `Preferred dealership: ${formData.get("preferredDealer")}`,
      formData.get("pickupLocation") && `Preferred pickup: ${formData.get("pickupLocation")}`,
      formData.get("nextService") && `Next service: ${formData.get("nextService")}`,
      formData.get("lastOilChange") && `Last oil change: ${formData.get("lastOilChange")}`,
      formData.get("lastDetail") && `Last detail: ${formData.get("lastDetail")}`,
      formData.get("brakeService") && `Brake service: ${formData.get("brakeService")}`,
      formData.get("recallStatus") && `Recall status: ${formData.get("recallStatus")}`,
      formData.get("serviceInterval") && `Service interval: ${formData.get("serviceInterval")}`,
      formData.get("tireSeason") && `Tire season: ${formData.get("tireSeason")}`,
      formData.get("storageNeeds") && `Storage needs: ${formData.get("storageNeeds")}`,
      formData.get("tireAge") && `Tire age: ${formData.get("tireAge")}`,
      formData.get("batteryAge") && `Battery age: ${formData.get("batteryAge")}`,
      formData.get("registration") && `Registration: ${formData.get("registration")}`,
    ].filter(Boolean).join("\n");

    try {
      const savedVehicle = await onUpdateVehicle(vehicle.id, {
        marketValue: formData.get("marketValue") || "Value pending",
        horsepower: formData.get("horsepower") || "HP pending",
        mileage: formData.get("mileage") || vehicle.mileage,
        status: formData.get("status") || vehicle.status,
        vin: formData.get("vin") || vehicle.vin,
        plate: formData.get("plate") || vehicle.plate,
        color: formData.get("color") || vehicle.color,
        condition: formData.get("condition") || vehicle.condition,
        location: formData.get("location") || vehicle.location,
        insurance: formData.get("insurance") || vehicle.insurance,
        warranty: formData.get("warranty") || vehicle.warranty,
        preferredDealer: formData.get("preferredDealer") || vehicle.preferredDealer,
        pickupLocation: formData.get("pickupLocation") || vehicle.pickupLocation,
        nextService: formData.get("nextService") || vehicle.nextService,
        lastOilChange: formData.get("lastOilChange") || vehicle.lastOilChange,
        lastDetail: formData.get("lastDetail") || vehicle.lastDetail,
        brakeService: formData.get("brakeService") || vehicle.brakeService,
        recallStatus: formData.get("recallStatus") || vehicle.recallStatus,
        serviceInterval: formData.get("serviceInterval") || vehicle.serviceInterval,
        tireSeason: formData.get("tireSeason") || vehicle.tireSeason,
        storageNeeds: formData.get("storageNeeds") || vehicle.storageNeeds,
        tireAge: formData.get("tireAge") || vehicle.tireAge,
        batteryAge: formData.get("batteryAge") || vehicle.batteryAge,
        registration: formData.get("registration") || vehicle.registration,
        notes: ownershipNotes,
        image: photoPreview || vehicle.image,
      });
      setPhotoPreview("");
      onComplete?.({
        actionLabel: "View Garage",
        actionTab: "garage",
        details: [
          ["Vehicle", vehicleLabel],
          ["Market value", savedVehicle?.marketValue || formData.get("marketValue") || marketValue],
          ["Status", savedVehicle?.status || formData.get("status") || vehicle.status || "Active"],
        ],
        message: "Your concierge profile for this vehicle has been updated. We will use these details for service, tracking, transport, and offer requests.",
        secondaryLabel: "Schedule Service",
        secondaryTab: "schedule",
        title: "Vehicle details successfully updated.",
      });
    } catch (error) {
      setDetailError(error.message || "Could not save this vehicle.");
    }
  }

  async function addWork(event) {
    event.preventDefault();
    setDetailError("");
    const formData = new FormData(event.currentTarget);
    const workItem = formData.get("workItem")?.trim();
    if (!workItem) return;
    const existingWork = workHistory.length ? workHistory : [];

    try {
      await onUpdateVehicle(vehicle.id, { workDone: [workItem, ...existingWork] });
      event.currentTarget.reset();
    } catch (error) {
      setDetailError(error.message || "Could not save the work history.");
    }
  }

  async function requestOffer() {
    setDetailError("");
    setOfferRequested(false);

    try {
      const savedRequest = await onGetOffer({
        vehicle: vehicleLabel,
        service: "Vehicle offer request",
        date: "",
        time: "",
        notes: `Member requested an offer. Current market value: ${marketValue}. Mileage: ${vehicle.mileage || "Mileage pending"}. VIN: ${vehicle.vin || "Needed"}. Location: ${vehicle.location || "Needed"}. Horsepower: ${vehicle.horsepower || "HP pending"}.`,
      });
      setOfferRequested(true);
      onComplete?.({
        actionLabel: "View Requests",
        actionTab: "schedule",
        details: [
          ["Request", savedRequest?.service || "Vehicle offer request"],
          ["Vehicle", savedRequest?.vehicle || vehicleLabel],
          ["Market value", marketValue],
        ],
        message: "Your offer request has been sent. White Glove will review the vehicle details and prepare the next step.",
        secondaryLabel: "Back to Garage",
        secondaryTab: "garage",
        title: "Offer request successfully updated.",
      });
    } catch (error) {
      setDetailError(error.message || "Could not request an offer for this vehicle.");
    }
  }

  async function deleteThisVehicle() {
    setDetailError("");
    const confirmed = window.confirm(`Delete ${vehicleLabel} from your Garage? This removes the vehicle from your account.`);
    if (!confirmed) return;

    try {
      setDeletingVehicle(true);
      await onDeleteVehicle(vehicle.id);
      onComplete?.({
        actionLabel: "Back to Garage",
        actionTab: "garage",
        details: [
          ["Vehicle", vehicleLabel],
          ["Status", "Deleted"],
        ],
        message: "This vehicle was removed from your Garage.",
        secondaryLabel: "Book Service",
        secondaryTab: "schedule",
        title: "Vehicle removed from Garage.",
      });
    } catch (error) {
      setDetailError(error.message || "Could not delete this vehicle.");
    } finally {
      setDeletingVehicle(false);
    }
  }

  return (
    <div className="app-stack">
      <section className="vehicle-detail-hero">
        <button className="text-button" type="button" onClick={onBack}>Back to Garage</button>
        <button className="text-button danger-text-button" type="button" onClick={deleteThisVehicle} disabled={deletingVehicle}>
          {deletingVehicle ? "Deleting..." : "Delete Car"}
        </button>
        <img alt={vehicleLabel} onError={handleImageError} src={photoPreview || vehicle.image || fallbackVehicleImage} />
        <div>
          <span>{vehicle.use || "Collection"}</span>
          <h2>{vehicleLabel}</h2>
          <p>{vehicle.status || "Active"} · {marketValue}</p>
        </div>
      </section>

      <section className="vehicle-stat-grid">
        <article>
          <strong>{marketValue}</strong>
          <span>Current market value</span>
        </article>
        <article>
          <strong>{vehicle.horsepower || "HP pending"}</strong>
          <span>Horsepower</span>
        </article>
        <article>
          <strong>{vehicle.mileage || "Mileage pending"}</strong>
          <span>Mileage</span>
        </article>
      </section>

      <section className="app-section">
        <div className="app-section-title">
          <div>
            <h2>Ownership Profile</h2>
            <p>Core details your concierge needs to manage service, transport, warranty, insurance, and documents.</p>
          </div>
        </div>
        <div className="profile-grid">
          {ownershipProfile.map(([label, value]) => (
            <article key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </article>
          ))}
        </div>
      </section>

      <section className="app-section">
        <div className="app-section-title">
          <div>
            <h2>Concierge Tracking</h2>
            <p>Everything White Glove should monitor for this vehicle.</p>
          </div>
        </div>
        <div className="tracker-list">
          {trackingItems.map((item) => (
            <article key={item.label}>
              <Check size={18} />
              <div>
                <h3>{item.label}</h3>
                <p>{item.detail}</p>
              </div>
              <span>{item.status}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="app-section">
        <div className="app-section-title">
          <div>
            <h2>Service History</h2>
            <p>Completed work and concierge requests stay attached to this vehicle for resale, planning, and ownership records.</p>
          </div>
        </div>
        <div className="service-history-list">
          {serviceHistory.length === 0 ? (
            <article>
              <ClipboardCheck size={20} />
              <div>
                <h3>No service history yet</h3>
                <p>Log completed work below or schedule this vehicle's first concierge request.</p>
              </div>
              <span>Ready</span>
            </article>
          ) : (
            serviceHistory.map((item) => (
              <article key={item.id}>
                <ClipboardCheck size={20} />
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.meta}</p>
                </div>
                <span>{item.status}</span>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="app-section offer-panel">
        <div>
          <h2>Get an offer for this vehicle</h2>
          <p>Request a concierge offer based on your vehicle details, mileage, condition notes, upgrades, and current market value.</p>
        </div>
        {offerRequested && (
          <div className="success-message" role="status">
            Offer request sent. Your concierge team will review this vehicle and follow up.
          </div>
        )}
        <button className="button primary submit" type="button" onClick={requestOffer}>
          Get Offer
        </button>
      </section>

      <section className="app-section">
        <h2>Update Vehicle Details</h2>
        <form className="app-form inline-form" onSubmit={saveDetails}>
          {detailError && (
            <div className="error-message" role="alert">
              {detailError}
            </div>
          )}
          <label className="upload-tile small-upload">
            {photoPreview ? <img alt="Updated vehicle preview" src={photoPreview} /> : <><Upload size={24} /><span>Upload new vehicle photo</span></>}
            <input accept="image/*" name="photo" onChange={handlePhoto} type="file" />
          </label>
          <div className="app-form-grid">
            <label>
              Current market value
              <input defaultValue={vehicle.marketValue || ""} name="marketValue" placeholder="$85,000" type="text" />
            </label>
            <label>
              Horsepower
              <input defaultValue={vehicle.horsepower || ""} name="horsepower" placeholder="503 hp" type="text" />
            </label>
            <label>
              Mileage
              <input defaultValue={vehicle.mileage || ""} name="mileage" placeholder="12,500" type="text" />
            </label>
            <label>
              Status
              <input defaultValue={vehicle.status || ""} name="status" placeholder="Detail due" type="text" />
            </label>
            <label>
              VIN
              <input defaultValue={vehicle.vin || ""} name="vin" placeholder="WP0AB2A9..." type="text" />
            </label>
            <label>
              License plate
              <input defaultValue={vehicle.plate || ""} name="plate" placeholder="ABC 123" type="text" />
            </label>
            <label>
              Color
              <input defaultValue={vehicle.color || ""} name="color" placeholder="Guards Red" type="text" />
            </label>
            <label>
              Condition
              <input defaultValue={vehicle.condition || ""} name="condition" placeholder="Excellent, good, needs attention" type="text" />
            </label>
            <label>
              Location
              <input defaultValue={vehicle.location || ""} name="location" placeholder="Home, office, storage" type="text" />
            </label>
            <label>
              Insurance
              <input defaultValue={vehicle.insurance || ""} name="insurance" placeholder="Provider or policy notes" type="text" />
            </label>
            <label>
              Warranty
              <input defaultValue={vehicle.warranty || ""} name="warranty" placeholder="Factory, extended, or none" type="text" />
            </label>
            <label>
              Preferred dealership
              <input defaultValue={vehicle.preferredDealer || ""} name="preferredDealer" placeholder="Dealer or shop" type="text" />
            </label>
            <label>
              Preferred pickup
              <input defaultValue={vehicle.pickupLocation || ""} name="pickupLocation" placeholder="Home, office, storage" type="text" />
            </label>
            <label>
              Next service
              <input defaultValue={vehicle.nextService || ""} name="nextService" placeholder="Oil change in 42 days" type="text" />
            </label>
            <label>
              Last oil change
              <input defaultValue={vehicle.lastOilChange || ""} name="lastOilChange" placeholder="May 2026 or 8,000 km ago" type="text" />
            </label>
            <label>
              Service interval
              <input defaultValue={vehicle.serviceInterval || ""} name="serviceInterval" placeholder="Every 6 months or 8,000 km" type="text" />
            </label>
            <label>
              Last detail
              <input defaultValue={vehicle.lastDetail || ""} name="lastDetail" placeholder="Spring 2026" type="text" />
            </label>
            <label>
              Brake service
              <input defaultValue={vehicle.brakeService || ""} name="brakeService" placeholder="Pads checked June 2026" type="text" />
            </label>
            <label>
              Recall status
              <input defaultValue={vehicle.recallStatus || ""} name="recallStatus" placeholder="Checked / needs dealer check" type="text" />
            </label>
            <label>
              Tire season
              <input defaultValue={vehicle.tireSeason || ""} name="tireSeason" placeholder="Summer, winter, all season" type="text" />
            </label>
            <label>
              Tire age
              <input defaultValue={vehicle.tireAge || ""} name="tireAge" placeholder="2 years" type="text" />
            </label>
            <label>
              Battery age
              <input defaultValue={vehicle.batteryAge || ""} name="batteryAge" placeholder="18 months" type="text" />
            </label>
            <label>
              Registration
              <input defaultValue={vehicle.registration || ""} name="registration" placeholder="Active or renewal date" type="text" />
            </label>
          </div>
          <label>
            Storage needs
            <textarea defaultValue={vehicle.storageNeeds || ""} name="storageNeeds" rows="2" placeholder="Indoor storage, battery tender, monthly start, fuel stabilizer..." />
          </label>
          <label>
            Internal notes
            <textarea defaultValue={vehicle.notes || ""} name="notes" rows="3" placeholder="Concierge notes, document status, owner preferences..." />
          </label>
          <button className="button primary submit" type="submit">Save Car Details</button>
        </form>
      </section>

      <section className="app-section">
        <h2>Work Done</h2>
        <form className="work-form" onSubmit={addWork}>
          <input name="workItem" placeholder="Add tune, wheels, ceramic coating, detail..." type="text" />
          <button className="button primary" type="submit"><Plus size={18} /> Add</button>
        </form>
        <div className="work-list">
          {workDone.map((item) => (
            <div key={item}>
              <Wrench size={16} />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function ServiceRequestCard({ appointment }) {
  const paymentSummary = appointment.paymentTitle || appointment.notes?.match(/Payment:\s*([^-.\n]+)/i)?.[1]?.trim();

  return (
    <article className="request-card">
      <div>
        <span>{appointment.status}</span>
        <h3>{appointment.service}</h3>
        <p>{appointment.vehicle}</p>
        {paymentSummary && <small>{paymentSummary}</small>}
      </div>
      <div className="request-date">
        <strong>{appointment.date || "Date pending"}</strong>
        <span>{appointment.time || "Time pending"}</span>
      </div>
    </article>
  );
}

function AppNavButton({ active, icon: Icon, label, onClick }) {
  return (
    <button className={active ? "app-nav-button active" : "app-nav-button"} type="button" onClick={onClick}>
      <Icon size={20} />
      <span>{label}</span>
    </button>
  );
}

function LeadSection({ handleSubmit, submitted, submitError }) {
  return (
    <section className="apply-section" id="apply">
      <div className="apply-copy">
        <p className="eyebrow">Apply</p>
        <h2>Request membership info</h2>
        <p>
          Tell us about your vehicles and what you want handled. Our team will contact you shortly to build your ownership management plan.
        </p>
        <div className="contact-strip">
          <span><MapPin size={18} /> Partner network coverage</span>
          <span><CalendarCheck size={18} /> Concierge coordination</span>
          <span><ShieldCheck size={18} /> Ownership management</span>
        </div>
      </div>

      <form className="lead-form" name="membership-lead" method="POST" data-netlify="true" data-netlify-honeypot="bot-field" onSubmit={handleSubmit}>
        <input type="hidden" name="form-name" value="membership-lead" />
        <label className="hidden-field">
          Do not fill this out
          <input name="bot-field" tabIndex="-1" autoComplete="off" />
        </label>
        {submitted && (
          <div className="success-message" role="status">
            Thank you. Our team will contact you shortly to build your custom vehicle care plan.
          </div>
        )}
        {submitError && (
          <div className="error-message" role="alert">
            {submitError}
          </div>
        )}
        <div className="form-grid">
          <label>
            Full name
            <input name="fullName" type="text" required />
          </label>
          <label>
            Phone number
            <input name="phone" type="tel" required />
          </label>
          <label>
            Email
            <input name="email" type="email" required />
          </label>
          <label>
            City
            <input name="city" type="text" required />
          </label>
          <label>
            How many vehicles?
            <input name="vehicleCount" type="number" min="1" placeholder="1" />
          </label>
          <label>
            Year
            <input name="year" type="number" min="1900" max="2035" />
          </label>
          <label>
            Make
            <input name="make" type="text" />
          </label>
          <label>
            Model
            <input name="model" type="text" />
          </label>
          <label>
            Mileage
            <input name="mileage" type="text" />
          </label>
          <label>
            Vehicle type
            <select name="vehicleType">
              <option>Luxury</option>
              <option>Exotic</option>
              <option>Classic</option>
              <option>Daily driver</option>
              <option>SUV or family vehicle</option>
              <option>Other</option>
            </select>
          </label>
          <label>
            Use
            <select name="usage">
              <option>Seasonal</option>
              <option>Daily driven</option>
              <option>Collection vehicle</option>
              <option>Occasional use</option>
            </select>
          </label>
          <label>
            Membership interest
            <select name="membership">
              <option>Not sure yet</option>
              <option>Silver</option>
              <option>Club Drive</option>
              <option>Gold</option>
              <option>Platinum</option>
              <option>Collector</option>
            </select>
          </label>
        </div>
        <fieldset>
          <legend>Services interested in</legend>
          <div className="checkbox-grid">
            {[
              "Maintenance",
              "Detailing",
              "Repairs",
              "Tires",
              "Transportation",
              "Vehicle storage",
              "Buying a vehicle",
              "Selling a vehicle",
              "Emergency assistance",
              "Insurance help",
              "Documents",
              "Collection management",
              "Fleet management",
              "Other",
            ].map((service) => (
              <label key={service}>
                <input type="checkbox" name="services" value={service} />
                {service}
              </label>
            ))}
          </div>
        </fieldset>
        <label>
          Tell us what you need help with
          <textarea name="message" rows="5" />
        </label>
        <button className="button primary submit" type="submit">
          Request Membership Info <ArrowRight size={18} />
        </button>
      </form>
    </section>
  );
}

function tabTitle(tab) {
  const titles = {
    home: "Dashboard",
    garage: "Garage",
    schedule: "Schedule",
    feed: "Feed",
    account: "Account",
  };
  return titles[tab];
}

function splitWorkList(value) {
  if (!value) return [];
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export default App;
