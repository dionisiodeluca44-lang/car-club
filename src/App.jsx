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
  Gift,
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
  getCurrentAccessToken,
  getCurrentMember,
  isBackendConfigured,
  loadFeedPosts,
  loadMembershipPricing,
  loadMembershipBenefitUsage,
  loadServicePricing,
  loadServiceRequests,
  loadVehicles,
  requestPasswordReset,
  resendConfirmationEmail,
  signIn,
  signOut,
  subscribeToFeedPosts,
  updateServiceRequestRecord,
  updateMemberPassword,
  updateMemberProfile,
  updateVehicleRecord,
} from "./lib/backend";
import {
  membershipBenefitCatalog,
  suggestedBenefitKeysForRequest,
  summarizeMembershipBenefits,
} from "../shared/membershipBenefits";

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
    items: ["Detailing", "Ceramic coating", "Vehicle wraps", "Paint protection film", "Window tint"],
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
    items: ["2 to 100 vehicles", "Preventive schedules", "Driver coordination", "Service records", "Vendor management"],
  },
];

const publicSiteUrl = import.meta.env.VITE_PUBLIC_SITE_URL || "https://vocal-pie-c034af.netlify.app";
const appStoreUrl = import.meta.env.VITE_APP_STORE_URL || "https://apps.apple.com/search?term=White%20Glove%20Concierge";

function isNativeAppRuntime() {
  if (typeof window === "undefined") return false;
  const capacitor = window.Capacitor;
  const platform = capacitor?.getPlatform?.();
  return capacitor?.isNativePlatform?.() === true || platform === "ios" || platform === "android" || /^(capacitor|ionic):\/\/localhost$/i.test(window.location.origin);
}

function netlifyFunctionUrl(path) {
  return isNativeAppRuntime() ? `${publicSiteUrl}${path}` : path;
}

function readableError(error, fallback = "Something went wrong. Please try again.") {
  if (!error) return fallback;
  if (typeof error === "string") return error === "{}" ? fallback : error;
  if (error.name === "AuthRetryableFetchError") {
    return "Supabase could not create the account right now. Try a real email address, then check Supabase Auth URL and email settings if it keeps happening.";
  }

  const message = error.message || error.error_description || error.error || error.msg;
  if (typeof message === "string" && message && message !== "{}") return message;
  if (message && typeof message === "object") {
    const nestedMessage = message.message || message.error_description || message.error || message.msg;
    if (typeof nestedMessage === "string" && nestedMessage && nestedMessage !== "{}") return nestedMessage;
  }

  try {
    const serialized = JSON.stringify(error);
    return serialized && serialized !== "{}" ? serialized : fallback;
  } catch {
    return fallback;
  }
}

const plans = [
  {
    name: "Silver",
    price: "$99",
    cadence: "/month",
    intro: "For owners who want the essentials managed with priority support.",
    features: ["1 × $70 annual maintenance-wash credit", "Service reminders", "Priority booking", "Basic vehicle health report", "Digital vehicle records"],
  },
  {
    name: "Club Drive",
    price: "$149",
    cadence: "/month",
    intro: "For owners who want pickup, delivery, and regular care coordination handled.",
    features: ["2 × $70 annual wash credits", "1 × $175 Montreal transport credit", "Pickup and delivery coordination", "Monthly vehicle check-in", "Priority service updates"],
  },
  {
    name: "Gold",
    price: "$199",
    cadence: "/month",
    intro: "For daily drivers and seasonal vehicles that need consistent care.",
    featured: true,
    features: ["4 × $70 annual wash credits", "1 × $150 full-detail credit", "1 × $175 Montreal transport credit", "Seasonal tire coordination", "Maintenance concierge"],
  },
  {
    name: "Platinum",
    price: "$399",
    cadence: "/month",
    intro: "For owners who want complete white-glove vehicle management.",
    features: ["6 × $70 annual wash credits", "2 × $150 full-detail credits", "3 × $175 Montreal transport credits", "$300 annual protection credit", "Complete maintenance concierge"],
  },
  {
    name: "Collector",
    price: "$699",
    cadence: "/month",
    intro: "For collections of up to three vehicles, with additional vehicles quoted separately.",
    features: ["12 × $70 annual wash credits", "4 × $150 full-detail credits", "6 × $175 Montreal transport credits", "$500 annual protection credit", "Dedicated collection manager"],
  },
];

const membershipAccessStatuses = new Set(["active", "trialing"]);

function hasMembershipAccess(status) {
  return membershipAccessStatuses.has(String(status || "").toLowerCase());
}

function membershipLifecycleContent(status) {
  switch (String(status || "pending").toLowerCase()) {
    case "past_due":
      return {
        eyebrow: "Payment required",
        title: "Your membership payment is past due.",
        description: "Member-app access is paused while the balance is outstanding. Use the secure Stripe payment email to update your payment method or complete payment, then check your status again.",
        canStartCheckout: false,
      };
    case "unpaid":
      return {
        eyebrow: "Membership unpaid",
        title: "Your membership needs billing attention.",
        description: "Stripe could not collect the membership balance after its retry period, so member-app access is paused. Contact White Glove or use Stripe's payment email to settle the balance, then check your status again.",
        canStartCheckout: false,
      };
    case "canceled":
      return {
        eyebrow: "Membership ended",
        title: "Reactivate your membership.",
        description: "Your previous subscription has ended and member-app access is paused. Choose a membership below and complete a new secure checkout to regain access.",
        canStartCheckout: true,
      };
    case "paused":
      return {
        eyebrow: "Membership paused",
        title: "Your membership is paused.",
        description: "Add or update your payment method through Stripe, then check your membership status. Access returns as soon as Stripe reports the subscription active again.",
        canStartCheckout: false,
      };
    case "incomplete_expired":
      return {
        eyebrow: "Activation expired",
        title: "Restart your membership activation.",
        description: "The previous checkout was not completed in time. Choose your membership and start a new secure Stripe checkout.",
        canStartCheckout: true,
      };
    default:
      return {
        eyebrow: "Membership activation",
        title: "Activate your account.",
        description: "Your account is created. Choose your membership and complete the secure checkout before the member app opens.",
        canStartCheckout: true,
      };
  }
}

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
    label: "Book an inspection",
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
    label: "Vehicle wrap",
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
    label: "Rent a car",
    allowedPlans: ["Gold", "Platinum", "Collector"],
  },
  {
    label: "Rent a driver",
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
  "Book an inspection": {
    category: "Inspection",
    deposit: 100,
    options: ["Pre-Purchase Inspection", "Annual Safety Inspection", "Post-Service Inspection", "Condition Report", "Lease Return Inspection", "Not Sure"],
    questions: ["Reason for inspection", "Preferred inspection location", "Deadline or purchase timeline", "Any concerns you want checked first"],
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
    note: "Performed in house. Base price; paint correction or extra preparation may increase the final price.",
  },
  "Paint protection film": {
    category: "Protection",
    deposit: 250,
    options: ["Partial Front", "Full Front", "Rocker Panels", "Door Cups / Door Edges", "Full Vehicle", "Custom / Not Sure"],
    note: "Performed in house. Final pricing depends on coverage, material, and vehicle condition.",
  },
  "Vehicle wrap": {
    category: "Protection",
    deposit: 250,
    options: ["Full Colour Change", "Partial Wrap", "Accent / Chrome Delete", "Commercial / Branding", "Wrap Removal", "Custom / Not Sure"],
    note: "Performed in house. Final pricing depends on material, coverage, preparation, and vehicle condition.",
  },
  "Window tint": {
    category: "Appearance",
    deposit: 100,
    options: ["Front Two Windows", "Rear Section", "Full Vehicle", "Windshield Sun Strip", "Remove and Replace Existing Tint", "Custom / Not Sure"],
    note: "Performed in house. Final pricing depends on film selection and vehicle configuration.",
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
      { name: "Local service area", price: 175 },
      { name: "Nearby service area", displayPrice: "From $225 CAD" },
      { name: "Extended distance", displayPrice: "From $250 CAD" },
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
  "Rent a car": {
    category: "Rental Concierge",
    deposit: 250,
    options: ["Luxury Sedan", "SUV", "Sports Car", "Exotic Vehicle", "Executive Vehicle", "Not Sure"],
    questions: ["Vehicle style and seating needs", "Rental start date and return date", "Delivery address", "Driver age and insurance needs"],
  },
  "Rent a driver": {
    category: "Chauffeur",
    deposit: 200,
    options: ["Airport Transfer", "Hourly Driver", "Full-Day Driver", "Event Driver", "Out-of-Town Trip", "Not Sure"],
    questions: ["Pickup and drop-off addresses", "Start and end time", "Passenger count", "Stops or waiting time needed"],
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

function serviceDetailFieldsForBooking(serviceLabel) {
  if (serviceLabel === "Rent a car") {
    return [
      { name: "rentalVehicleType", label: "Vehicle preference", placeholder: "SUV, sports car, luxury sedan, or similar" },
      { name: "rentalStartDate", label: "Start date", type: "date" },
      { name: "rentalEndDate", label: "Return date", type: "date" },
      { name: "rentalDeliveryAddress", label: "Delivery address", placeholder: "Where should the rental be delivered?" },
      { name: "rentalPassengers", label: "Passengers and luggage", placeholder: "Passengers, luggage, child seats, or special needs" },
    ];
  }

  if (serviceLabel === "Rent a driver") {
    return [
      { name: "driverPickupAddress", label: "Pickup address", placeholder: "Where should the driver meet you?" },
      { name: "driverDropoffAddress", label: "Destination", placeholder: "Main destination or route" },
      { name: "driverStartDate", label: "Service date", type: "date" },
      { name: "driverStartTime", label: "Start time", type: "time" },
      { name: "driverHours", label: "Estimated time needed", placeholder: "One way, hourly, full day, or not sure" },
      { name: "driverPassengers", label: "Passenger details", placeholder: "Passenger count, stops, luggage, waiting time" },
    ];
  }

  if (serviceLabel === "Book an inspection") {
    return [
      { name: "inspectionReason", label: "Inspection goal", placeholder: "Pre-purchase, annual safety, condition report, or concern" },
      { name: "inspectionLocation", label: "Inspection location", placeholder: "Seller, dealer, home, storage, or shop address" },
      { name: "inspectionDeadline", label: "Needed by", type: "date" },
      { name: "inspectionConcerns", label: "Main concerns", placeholder: "Leaks, brakes, electronics, accident history, warning lights" },
    ];
  }

  return [];
}

function serviceRequiresSavedVehicle(serviceLabel) {
  return !["Rent a car", "Rent a driver"].includes(serviceLabel);
}

function formatCad(amount) {
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount)) return `$${amount} CAD`;
  return `$${Number.isInteger(numericAmount) ? numericAmount : numericAmount.toFixed(2)} CAD`;
}

function vehicleClassFromVehicle(vehicle = {}) {
  const combined = `${vehicle.vehicleType || ""} ${vehicle.type || ""} ${vehicle.use || ""} ${vehicle.model || ""}`.toLowerCase();
  if (/truck|pickup|f-150|silverado|ram|sierra|tacoma|tundra/.test(combined)) return "truck";
  if (/van|minivan|sprinter|sienna|odyssey|caravan/.test(combined)) return "van";
  if (/suv|crossover|x5|x3|gle|glc|range rover|cayenne|macan|urus|q5|q7|rav4|cr-v|highlander|escalade|yukon|tahoe/.test(combined)) return "suv";
  return "car";
}

function paymentTermsFromPricing(serviceLabel, pricing) {
  const amountCents = Number(pricing?.amountCents ?? pricing?.amount_cents ?? 0);
  const paymentMode = pricing?.paymentMode || pricing?.payment_mode || "deposit";
  const note = pricing?.note || "";

  if (paymentMode === "free" || amountCents <= 0) {
    return {
      amount: "Free request",
      amountCents: 0,
      mode: "free",
      note: note || "White Glove will review the request and follow up with next steps.",
      title: "No payment due now",
    };
  }

  if (paymentMode === "full") {
    return {
      amount: `${formatCad(amountCents / 100)} plus taxes at checkout`,
      amountCents,
      mode: "full",
      note: note || "This service has a confirmed price.",
      title: "Pay in full",
    };
  }

  return {
    amount: `${formatCad(amountCents / 100)} deposit today`,
    amountCents,
    mode: "deposit",
    note: note || "Final price will be confirmed after reviewing the vehicle and requested work. Your deposit is applied to the final invoice.",
    title: "Security deposit",
  };
}

function defaultPricingForService(serviceLabel) {
  const catalog = serviceCatalogForLabel(serviceLabel);
  const optionWithAmount = catalog?.options?.find((option) => {
    if (typeof option === "string") return false;
    return option.price === 0 || option.price || option.deposit || option.prices?.car;
  });
  const option = typeof optionWithAmount === "string" ? {} : optionWithAmount || {};

  if (option.price === 0) {
    return {
      amountCents: 0,
      note: "White Glove will review the request and follow up with next steps.",
      paymentMode: "free",
    };
  }

  if (option.price) {
    return {
      amountCents: Math.round(option.price * 100),
      note: "This service has a clear fixed price for the selected option.",
      paymentMode: "full",
    };
  }

  if (option.prices?.car) {
    return {
      amountCents: Math.round(option.prices.car * 100),
      note: "This service has fixed pricing based on the selected Garage vehicle.",
      paymentMode: "full",
    };
  }

  const depositAmount = option.deposit || catalog?.deposit;
  if (depositAmount) {
    return {
      amountCents: Math.round(depositAmount * 100),
      note: catalog?.note || defaultDepositTerms.note,
      paymentMode: "deposit",
    };
  }

  const rule = servicePaymentRules[serviceLabel];
  if (rule?.mode === "full") {
    return {
      amountCents: 0,
      note: rule.note,
      paymentMode: "full",
    };
  }

  return {
    amountCents: 10000,
    note: defaultDepositTerms.note,
    paymentMode: "deposit",
  };
}

function normalizeServicePricingRows(rows = []) {
  return rows.reduce((pricing, row) => {
    const serviceLabel = row.serviceLabel || row.service_label;
    if (!serviceLabel) return pricing;

    pricing[serviceLabel] = {
      amountCents: Number(row.amountCents ?? row.amount_cents ?? 0),
      note: row.note || "",
      paymentMode: row.paymentMode || row.payment_mode || "deposit",
      serviceLabel,
      updatedAt: row.updatedAt || row.updated_at,
    };
    return pricing;
  }, {});
}

function planAmountCents(plan) {
  const match = String(plan?.price || "").match(/[\d,.]+/);
  if (!match) return null;
  return Math.round(Number(match[0].replace(/,/g, "")) * 100);
}

function defaultMembershipPricingForPlan(planName) {
  const plan = plans.find((item) => item.name === planName) || plans.find((item) => item.name === "Club Drive");
  return {
    amountCents: planAmountCents(plan),
    cadence: plan?.cadence || "/month",
    note: plan?.intro || "",
    planName: plan?.name || planName,
  };
}

function normalizeMembershipPricingRows(rows = []) {
  if (!Array.isArray(rows)) return rows || {};

  return rows.reduce((pricing, row) => {
    const planName = row.planName || row.plan_name;
    if (!planName) return pricing;

    pricing[planName] = {
      amountCents: row.amountCents ?? row.amount_cents ?? null,
      cadence: row.cadence || "/month",
      note: row.note || "",
      planName,
      updatedAt: row.updatedAt || row.updated_at,
    };
    return pricing;
  }, {});
}

function membershipPricingForPlan(planName, membershipPricing = {}) {
  const fallback = defaultMembershipPricingForPlan(planName);
  const saved = membershipPricing?.[planName] || {};

  return {
    ...fallback,
    ...saved,
    amountCents: saved.amountCents ?? fallback.amountCents,
  };
}

function membershipPriceLabel(planName, membershipPricing = {}) {
  const pricing = membershipPricingForPlan(planName, membershipPricing);
  if (pricing.amountCents === null || pricing.amountCents === undefined) return "Custom";
  return formatCad(pricing.amountCents / 100).replace(" CAD", "");
}

function paymentTermsForService(serviceLabel, vehicle, selectedOptionName, servicePricing = {}) {
  if (servicePricing?.[serviceLabel]) {
    return paymentTermsFromPricing(serviceLabel, servicePricing[serviceLabel]);
  }

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
    description: "White Glove schedules pickup and return within Montreal.",
    direction: "two-way",
    label: "Montreal pickup and return",
    value: "pickup-two-way",
  },
  {
    amountCents: 22500,
    description: "Montreal transport rate plus the $50 nearby off-island surcharge.",
    direction: "two-way-near-off-island",
    label: "Nearby off-island pickup and return",
    value: "pickup-two-way-near-off-island",
  },
  {
    amountCents: 25000,
    description: "Starting price including the $75 extended off-island surcharge.",
    direction: "two-way-extended-off-island",
    label: "Extended off-island pickup and return",
    value: "pickup-two-way-extended-off-island",
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
  return hasCollectionPackage(plan) ? 3 : 1;
}

function canAddGarageVehicle(plan, garageCount) {
  return garageCount < garageVehicleLimit(plan);
}

function garageLimitLabel(plan) {
  return hasCollectionPackage(plan) ? "Up to 3 vehicles" : "1 vehicle";
}

const approvedOrClosedRequestStatuses = new Set(["approved", "booked", "paid / confirmed", "completed", "cancelled", "canceled"]);

function normalizeRequestValue(value) {
  return String(value || "").trim().toLowerCase();
}

function isRequestApprovedOrClosed(status) {
  return approvedOrClosedRequestStatuses.has(normalizeRequestValue(status));
}

function hasOpenMatchingServiceRequest(appointments, appointment) {
  const serviceKey = normalizeRequestValue(appointment?.service);
  const vehicleKey = normalizeRequestValue(appointment?.vehicle);
  const vehicleIdKey = normalizeRequestValue(appointment?.vehicleId);

  if (!serviceKey || (!vehicleKey && !vehicleIdKey)) return false;

  return ensureList(appointments).some((request) => {
    const sameService = normalizeRequestValue(request.service) === serviceKey;
    const sameVehicle = vehicleIdKey
      ? normalizeRequestValue(request.vehicleId) === vehicleIdKey || normalizeRequestValue(request.vehicle) === vehicleKey
      : normalizeRequestValue(request.vehicle) === vehicleKey;

    return sameService && sameVehicle && !isRequestApprovedOrClosed(request.status);
  });
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
    make: "Sample",
    model: "Performance Coupe",
    mileage: "18,400",
    use: "Seasonal",
    status: "Detail due",
    marketValue: "$142,000",
    horsepower: "379 hp",
    vin: "VIN-SAMPLE-COUPE",
    location: "Storage location",
    insurance: "Collector policy active",
    warranty: "Factory warranty expired",
    preferredDealer: "Preferred service center",
    pickupLocation: "Primary address",
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
    make: "Sample",
    model: "Daily SUV",
    mileage: "7,950",
    use: "Daily",
    status: "Health report ready",
    marketValue: "$118,000",
    horsepower: "355 hp",
    vin: "VIN-SAMPLE-SUV",
    location: "Daily driver",
    insurance: "Personal policy active",
    warranty: "Factory warranty active",
    preferredDealer: "Preferred dealer",
    pickupLocation: "Work address",
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
    vehicle: "2021 Sample Performance Coupe",
    service: "Full detail",
    date: "2026-07-08",
    time: "10:00",
    status: "Requested",
  },
];

const fallbackVehicleImage = "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=900&q=85";
const vehicleLookupApiBase = "https://vpic.nhtsa.dot.gov/api/vehicles";
const fallbackVehicleMakes = [
  "Acura",
  "Alfa Romeo",
  "Aston Martin",
  "Audi",
  "Bentley",
  "BMW",
  "Bugatti",
  "Buick",
  "Cadillac",
  "Chevrolet",
  "Chrysler",
  "Dodge",
  "Ferrari",
  "Fiat",
  "Ford",
  "Genesis",
  "GMC",
  "Honda",
  "Hyundai",
  "Infiniti",
  "Jaguar",
  "Jeep",
  "Kia",
  "Lamborghini",
  "Land Rover",
  "Lexus",
  "Lincoln",
  "Lotus",
  "Maserati",
  "Mazda",
  "McLaren",
  "Mercedes-Benz",
  "Mini",
  "Mitsubishi",
  "Nissan",
  "Porsche",
  "Ram",
  "Rolls-Royce",
  "Subaru",
  "Tesla",
  "Toyota",
  "Volkswagen",
  "Volvo",
];

const fallbackModelSuggestions = {
  audi: ["A3", "A4", "A5", "A6", "A7", "A8", "Q3", "Q5", "Q7", "Q8", "RS 3", "RS 5", "RS 6", "R8"],
  bmw: ["2 Series", "3 Series", "4 Series", "5 Series", "7 Series", "X3", "X5", "X7", "M2", "M3", "M4", "M5", "M8"],
  chevrolet: ["Camaro", "Corvette", "Malibu", "Tahoe", "Suburban", "Silverado", "Blazer", "Equinox"],
  ferrari: ["Roma", "Portofino", "296", "F8", "SF90", "812", "Purosangue"],
  ford: ["Bronco", "Escape", "Explorer", "F-150", "Mustang", "Ranger", "Super Duty"],
  honda: ["Accord", "Civic", "CR-V", "HR-V", "Odyssey", "Passport", "Pilot", "Ridgeline"],
  lamborghini: ["Aventador", "Huracan", "Revuelto", "Urus"],
  lexus: ["ES", "IS", "LC", "LS", "LX", "NX", "RC", "RX", "TX", "UX"],
  "mercedes-benz": ["A-Class", "C-Class", "E-Class", "S-Class", "CLA", "CLS", "GLA", "GLC", "GLE", "GLS", "G-Class", "AMG GT"],
  porsche: ["718", "911", "Cayenne", "Macan", "Panamera", "Taycan"],
  tesla: ["Model 3", "Model S", "Model X", "Model Y", "Cybertruck"],
  toyota: ["4Runner", "Camry", "Corolla", "Crown", "GR86", "Highlander", "Land Cruiser", "Prius", "RAV4", "Sequoia", "Supra", "Tacoma", "Tundra"],
};

function ensureList(value) {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

function uniqueImageList(images) {
  return [...new Set(ensureList(images).filter(Boolean))].slice(0, 10);
}

function uniqueSortedStrings(values) {
  return [...new Set(ensureList(values).map((value) => String(value || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function vehicleImageGallery(vehicle = {}) {
  return uniqueImageList([...(Array.isArray(vehicle.images) ? vehicle.images : []), vehicle.image]);
}

function primaryVehicleImage(vehicle = {}) {
  return vehicleImageGallery(vehicle)[0] || fallbackVehicleImage;
}

function handleVehicleImageError(event) {
  event.currentTarget.src = fallbackVehicleImage;
}

function dateInputValue(value) {
  const text = String(value || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
}

function isFutureServiceDate(value) {
  if (!dateInputValue(value)) return true;
  const serviceDate = new Date(`${value}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return serviceDate.getTime() > today.getTime();
}

function serviceIconForRequest(service = "") {
  const label = service.toLowerCase();
  if (label.includes("detail") || label.includes("cosmetic") || label.includes("ceramic") || label.includes("paint")) return Sparkles;
  if (label.includes("transport") || label.includes("pickup") || label.includes("delivery")) return MapPin;
  if (label.includes("storage")) return Warehouse;
  if (label.includes("inspection") || label.includes("insurance") || label.includes("document")) return ClipboardCheck;
  if (label.includes("buy") || label.includes("sell") || label.includes("offer") || label.includes("rent a car")) return Car;
  if (label.includes("driver")) return KeyRound;
  if (label.includes("tire") || label.includes("brake") || label.includes("oil") || label.includes("battery") || label.includes("maintenance")) return Wrench;
  return CalendarCheck;
}

function normalizeVehicleLookupKey(value) {
  return String(value || "").trim().toLowerCase();
}

async function fetchVehicleMakes() {
  const response = await fetch(`${vehicleLookupApiBase}/GetMakesForVehicleType/car?format=json`);
  if (!response.ok) throw new Error("Vehicle makes could not load.");
  const payload = await response.json();
  return uniqueSortedStrings((payload.Results || []).map((item) => item.MakeName));
}

async function fetchVehicleModels({ make, year }) {
  if (!make) return [];
  const safeMake = encodeURIComponent(make);
  const safeYear = String(year || "").trim();
  const endpoint = safeYear
    ? `${vehicleLookupApiBase}/GetModelsForMakeYear/make/${safeMake}/modelyear/${encodeURIComponent(safeYear)}?format=json`
    : `${vehicleLookupApiBase}/GetModelsForMake/${safeMake}?format=json`;
  const response = await fetch(endpoint);
  if (!response.ok) throw new Error("Vehicle models could not load.");
  const payload = await response.json();
  return uniqueSortedStrings((payload.Results || []).map((item) => item.Model_Name));
}

function fallbackModelsForMake(make) {
  return fallbackModelSuggestions[normalizeVehicleLookupKey(make)] || [];
}

function parseVehicleDate(value) {
  const text = dateInputValue(value);
  return text ? new Date(`${text}T00:00:00`) : null;
}

function daysUntilDate(value, now = new Date()) {
  const target = parseVehicleDate(value);
  if (!target) return null;
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - start.getTime()) / 86400000);
}

function daysSinceDate(value, now = new Date()) {
  const target = parseVehicleDate(value);
  if (!target) return null;
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor((start.getTime() - target.getTime()) / 86400000));
}

function appointmentDateTime(appointment) {
  if (!dateInputValue(appointment?.date)) return null;
  return new Date(`${appointment.date}T${appointment.time || "09:00"}`);
}

function countdownLabel(target, nowMs) {
  const differenceMs = target.getTime() - nowMs;
  if (differenceMs <= 0) return { primary: "00:00:00", secondary: "Service day" };
  const totalSeconds = Math.max(0, Math.floor(differenceMs / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const twoDigits = (value) => String(value).padStart(2, "0");
  if (days > 0) return { primary: `${days}d ${twoDigits(hours)}h`, secondary: `${twoDigits(minutes)}m ${twoDigits(seconds)}s` };
  return { primary: `${twoDigits(hours)}:${twoDigits(minutes)}:${twoDigits(seconds)}`, secondary: "until service" };
}

function upcomingAppointmentCountdowns(appointments, nowMs) {
  return ensureList(appointments)
    .filter((appointment) => !["completed", "cancelled", "canceled"].includes(normalizeRequestValue(appointment?.status)))
    .map((appointment) => {
      const target = appointmentDateTime(appointment);
      if (!target) return null;
      const countdown = countdownLabel(target, nowMs);
      return {
        ...appointment,
        countdown,
        target,
      };
    })
    .filter((appointment) => appointment && appointment.target.getTime() >= nowMs - 86400000)
    .sort((a, b) => a.target.getTime() - b.target.getTime());
}

function readFilesAsDataUrls(fileList, limit = 10) {
  const files = Array.from(fileList || []).filter((file) => file.type?.startsWith("image/")).slice(0, limit);

  return Promise.all(files.map((file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Could not read one of the photos."));
    reader.readAsDataURL(file);
  })));
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
  const images = vehicleImageGallery(safeVehicle);

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
    image: images[0] || fallbackVehicleImage,
    images: images.length ? images : [fallbackVehicleImage],
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
    const dueDays = daysUntilDate(vehicle.nextService) ?? parseDueDays(vehicle.nextService);
    const oilAgeDays = daysSinceDate(vehicle.lastOilChange);
    const tireAgeDays = daysSinceDate(vehicle.tireAge);
    const batteryAgeDays = daysSinceDate(vehicle.batteryAge);

    if (dueDays !== null && canBookService(plan, "Oil change")) {
      reminders.push({
        id: `${vehicle.id}-oil`,
        vehicle: label,
        service: "Oil change",
        title: dueDays >= 0 ? `Service due in ${dueDays} days` : `Service overdue by ${Math.abs(dueDays)} days`,
        message: `Would you like White Glove to schedule service for your ${label}?`,
        urgency: dueDays <= 0 ? "Overdue" : dueDays <= 14 ? "Due soon" : "Upcoming",
      });
    }

    if (oilAgeDays !== null && oilAgeDays >= 180 && canBookService(plan, "Oil change")) {
      reminders.push({
        id: `${vehicle.id}-oil-age`,
        vehicle: label,
        service: "Oil change",
        title: "Oil service should be reviewed",
        message: `${label} has not logged an oil change in about ${Math.round(oilAgeDays / 30)} months.`,
        urgency: oilAgeDays >= 365 ? "Overdue" : "Preventive",
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

    if (((batteryAgeDays !== null && batteryAgeDays >= 540) || String(vehicle.batteryAge).match(/18|24|2 year|3 year/i)) && canBookService(plan, "Battery service")) {
      reminders.push({
        id: `${vehicle.id}-battery`,
        vehicle: label,
        service: "Battery service",
        title: "Battery check recommended",
        message: `Your ${label} battery timing suggests a test or replacement should be considered.`,
        urgency: "Preventive",
      });
    }

    if (((tireAgeDays !== null && tireAgeDays >= 730) || String(vehicle.tireAge).match(/2 year|3 year|4 year|5 year/i)) && canBookService(plan, "Tires")) {
      reminders.push({
        id: `${vehicle.id}-tires`,
        vehicle: label,
        service: "Tires",
        title: "Tire inspection recommended",
        message: `Your ${label} tire timing suggests inspection, changeover, or replacement planning.`,
        urgency: "Preventive",
      });
    }
  });

  return reminders.slice(0, 6);
}

function vehiclePerformanceClass(vehicle = {}) {
  const text = `${vehicle.make || ""} ${vehicle.model || ""} ${vehicle.use || ""}`.toLowerCase();
  if (text.match(/ferrari|lamborghini|mclaren|aston|bugatti|gt3|911|amg|\bm\b|\brs\b|corvette|track/)) return "performance";
  if (text.match(/range rover|g-class|g wagon|cayenne|macan|x5|x7|q7|q8|suv|truck/)) return "suv";
  if (text.match(/tesla|taycan|ev|electric|model 3|model y|model s|model x/)) return "ev";
  return "daily";
}

function garageInsightItems(garage) {
  return ensureList(garage).flatMap((vehicle) => {
    const label = vehicleLabel(vehicle);
    const make = String(vehicle.make || "").toLowerCase();
    const modelText = `${vehicle.make || ""} ${vehicle.model || ""}`.toLowerCase();
    const mileage = Number.parseInt(String(vehicle.mileage || "").replace(/\D/g, ""), 10) || 0;
    const vehicleClass = vehiclePerformanceClass(vehicle);
    const items = [];

    if (!vehicle.lastOilChange || daysSinceDate(vehicle.lastOilChange) >= 180) {
      items.push({
        id: `${vehicle.id}-insight-oil`,
        type: "Maintenance",
        title: "Plan an oil and filter service",
        detail: `${label} should have a fresh oil record for reliability and resale history.`,
        icon: Wrench,
      });
    }

    if (vehicleClass === "performance") {
      items.push({
        id: `${vehicle.id}-insight-performance`,
        type: "Recommended mod",
        title: "Protect paint and wheels",
        detail: `${label} would benefit from paint protection film, ceramic coating, and wheel/tire inspection records.`,
        icon: Sparkles,
      });
    } else if (vehicleClass === "ev") {
      items.push({
        id: `${vehicle.id}-insight-ev`,
        type: "Maintenance",
        title: "Check tires, brakes, and battery health",
        detail: `${label} should have tire wear, brake condition, and high-voltage battery health tracked.`,
        icon: Gauge,
      });
    } else if (vehicleClass === "suv") {
      items.push({
        id: `${vehicle.id}-insight-suv`,
        type: "Recommended mod",
        title: "Add all-weather protection",
        detail: `${label} is a good candidate for all-weather mats, cargo protection, and seasonal tire planning.`,
        icon: ShieldCheck,
      });
    }

    if (mileage >= 60000) {
      items.push({
        id: `${vehicle.id}-insight-mileage`,
        type: "Maintenance",
        title: "Mileage-based inspection",
        detail: `${label} is in the range where brakes, fluids, suspension, tires, and battery condition should be reviewed.`,
        icon: ClipboardCheck,
      });
    }

    if (make.match(/bmw|mercedes|audi|porsche|land rover|jaguar|volkswagen/)) {
      items.push({
        id: `${vehicle.id}-insight-euro`,
        type: "Common watch item",
        title: "Watch electronics, cooling, and suspension",
        detail: `${label} should be watched for battery health, cooling-system leaks, suspension wear, and warning-light history.`,
        icon: Clock,
      });
    } else if (make.match(/toyota|lexus|honda|acura|mazda|subaru|nissan|infiniti/)) {
      items.push({
        id: `${vehicle.id}-insight-japanese`,
        type: "Common watch item",
        title: "Watch fluids, tires, and wear items",
        detail: `${label} usually benefits from clean fluid records, tire rotation history, brake inspection, and alignment checks.`,
        icon: ClipboardCheck,
      });
    } else if (make.match(/ford|chevrolet|gmc|cadillac|dodge|jeep|ram|lincoln/)) {
      items.push({
        id: `${vehicle.id}-insight-domestic`,
        type: "Common watch item",
        title: "Watch driveline, brakes, and software updates",
        detail: `${label} should have brakes, drivetrain service, tire wear, and software/service campaign checks tracked.`,
        icon: Wrench,
      });
    }

    if (modelText.match(/turbo|amg|\bm\b|\brs\b|gt|911|corvette|hellcat|track/)) {
      items.push({
        id: `${vehicle.id}-insight-sport`,
        type: "Recommended mod",
        title: "Performance ownership records",
        detail: `${label} should keep alignment, tire, brake, and fluid history especially clean.`,
        icon: Gauge,
      });
    }

    return items.slice(0, 4);
  }).slice(0, 8);
}

function webSearchUrl(query) {
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

function primaryGarageVehicle(garage) {
  return ensureList(garage)[0] || {};
}

function homeSmartCards({ garage, insights, reminders }) {
  const vehicle = primaryGarageVehicle(garage);
  const label = vehicleLabel(vehicle);
  const hasVehicle = Boolean(vehicle.make || vehicle.model);
  const maintenance = insights.find((item) => item.type === "Maintenance" || item.type === "Common watch item") || reminders[0];
  const tuning = insights.find((item) => item.type === "Recommended mod") || insights.find((item) => item.type === "Maintenance");
  const vehicleQuery = hasVehicle ? label : "cars";

  return [
    {
      cta: "Research",
      href: webSearchUrl(`${vehicleQuery} common problems maintenance recommended service`),
      icon: Wrench,
      label: "Recommended services",
      text: maintenance?.detail || maintenance?.message || (hasVehicle ? `Find common maintenance needs for ${label}.` : "Add a vehicle to unlock smart service recommendations."),
      title: maintenance?.title || "Common maintenance needs",
    },
    {
      cta: "Research",
      href: webSearchUrl(`${vehicleQuery} recommended tuning upgrades forum`),
      icon: Gauge,
      label: "Recommended tuning",
      text: tuning?.detail || (hasVehicle ? `Explore common upgrades and tuning ideas for ${label}.` : "Add a vehicle to unlock tuning recommendations."),
      title: tuning?.title || "Popular upgrades",
    },
    {
      cta: "News",
      href: webSearchUrl(`${vehicleQuery} automotive news latest`),
      icon: Upload,
      label: "Car news",
      text: hasVehicle ? `Open current news and owner discussions around ${label}.` : "Open current automotive news and market updates.",
      title: hasVehicle ? `${label} news` : "Latest car news",
    },
  ];
}

const feedEventPrefix = "[WG_EVENT]";
const eventFallbackImage = "https://images.unsplash.com/photo-1503736334956-4c8f8e92946d?auto=format&fit=crop&w=900&q=85";

function encodeFeedEvent({ description, place, time, title }) {
  return [
    feedEventPrefix,
    `Title: ${title || "Member event"}`,
    `Time: ${time || "Time pending"}`,
    `Place: ${place || "Place pending"}`,
    `Description: ${description || "Details pending"}`,
  ].join("\n");
}

function readEventLine(caption, label) {
  const line = String(caption || "").split("\n").find((item) => item.startsWith(`${label}:`));
  return line ? line.slice(label.length + 1).trim() : "";
}

function parseFeedEvent(post = {}) {
  if (!String(post.caption || "").startsWith(feedEventPrefix)) return null;
  return {
    description: readEventLine(post.caption, "Description"),
    place: readEventLine(post.caption, "Place"),
    time: readEventLine(post.caption, "Time"),
    title: readEventLine(post.caption, "Title") || "Member event",
  };
}

function feedEventPosts(posts) {
  return ensureList(posts).filter((post) => parseFeedEvent(post));
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
  const [mode, setMode] = useState(() => new URLSearchParams(window.location.search).get("password") === "recovery" ? "password-recovery" : "site");
  const [menuOpen, setMenuOpen] = useState(false);
  const [memberAccessChoiceOpen, setMemberAccessChoiceOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [appError, setAppError] = useState("");
  const [signupConfirmationEmail, setSignupConfirmationEmail] = useState("");
  const [checkoutCompletion, setCheckoutCompletion] = useState(null);
  const [adminMode, setAdminMode] = useState(() => window.location.hash === "#admin");
  const [runtimeError, setRuntimeError] = useState("");
  const [loadingAccount, setLoadingAccount] = useState(isBackendConfigured);
  const [member, setMember] = useState(() => {
    if (isBackendConfigured) return null;
    const storedMember = readStoredJson("carClubMember", null);
    return storedMember ? { ...storedMember, subscriptionStatus: storedMember.subscriptionStatus || "active" } : null;
  });
  const [garage, setGarage] = useState(() => {
    return ensureList(readStoredJson("carClubGarage", defaultGarage));
  });
  const [appointments, setAppointments] = useState(() => {
    return ensureList(readStoredJson("carClubAppointments", defaultAppointments));
  });
  const [benefitUsage, setBenefitUsage] = useState(() => {
    return ensureList(readStoredJson("carClubBenefitUsage", []));
  });
  const [feedPosts, setFeedPosts] = useState(() => {
    return ensureList(readStoredJson("carClubFeedPosts", []));
  });
  const [servicePricing, setServicePricing] = useState({});
  const [membershipPricing, setMembershipPricing] = useState({});
  const nativeAppRuntime = isNativeAppRuntime();
  const memberAccessLabel = nativeAppRuntime ? "Sign in / Sign up" : "Open Member App";

  const closeMenu = () => setMenuOpen(false);

  function openMemberAccess() {
    closeMenu();
    if (nativeAppRuntime) {
      setMode(member ? "app" : "login");
      return;
    }

    setMemberAccessChoiceOpen(true);
  }

  function continueMemberAccessOnWeb() {
    setMemberAccessChoiceOpen(false);
    setMode(member ? "app" : "login");
  }

  function openMemberAccessInStore() {
    setMemberAccessChoiceOpen(false);
    window.location.href = appStoreUrl;
  }

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
    let active = true;

    async function loadPricing() {
      try {
        const savedPricing = await loadServicePricing();
        if (active) setServicePricing(savedPricing);
      } catch (error) {
        console.warn("Could not load service pricing.", error);
      }
    }

    loadPricing();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadPricing() {
      try {
        const savedPricing = await loadMembershipPricing();
        if (active) setMembershipPricing(normalizeMembershipPricingRows(savedPricing));
      } catch (error) {
        console.warn("Could not load membership pricing.", error);
      }
    }

    loadPricing();

    return () => {
      active = false;
    };
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
    const membershipStatus = params.get("membership");
    const signupStatus = params.get("signup");

    if (signupStatus === "confirm-email") {
      const pendingEmail = localStorage.getItem("whiteGlovePendingSignupEmail") || "";
      setMember(null);
      setSignupConfirmationEmail(pendingEmail);
      setAppError("");
      setLoadingAccount(false);
      setMode("signup-confirmation");
      window.history.replaceState({}, "", window.location.pathname);
    }

    if (signupStatus === "payment-cancelled") {
      setMember(null);
      setAppError("Membership checkout was cancelled. Create your account again or sign in if you already confirmed your email.");
      setLoadingAccount(false);
      setMode("login");
      window.history.replaceState({}, "", window.location.pathname);
    }

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

    if (membershipStatus === "success") {
      setAppError("Membership payment received. We are checking your activation now.");
      setMode("app");
      window.history.replaceState({}, "", window.location.pathname);
      if (isBackendConfigured) {
        getCurrentMember()
          .then((currentMember) => {
            if (currentMember) {
              setMember(currentMember);
              setAppError(hasMembershipAccess(currentMember.subscriptionStatus) ? "" : "Payment received. If your account is not open yet, check your membership status again in a few seconds.");
            }
          })
          .catch(() => {
            setAppError("Payment received. Sign in again if your account does not open automatically.");
          });
      }
    }

    if (membershipStatus === "cancelled") {
      setAppError("Membership checkout was cancelled. Your membership status has not changed.");
      setMode("app");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  useEffect(() => {
    let active = true;

    async function loadAccount() {
      const params = new URLSearchParams(window.location.search);
      if (params.get("password") === "recovery" || params.has("signup")) {
        setLoadingAccount(false);
        return;
      }

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

        if (!hasMembershipAccess(currentMember.subscriptionStatus)) {
          setMember(currentMember);
          setGarage([]);
          setAppointments([]);
          setFeedPosts([]);
          setBenefitUsage([]);
          setMode("app");
          return;
        }

        const [savedGarage, savedAppointments, savedFeedPosts, savedBenefitUsage] = await Promise.all([
          loadVehicles(currentMember.id),
          loadServiceRequests(currentMember.id),
          loadFeedPosts(),
          loadMembershipBenefitUsage(currentMember.id),
        ]);

        if (!active) return;
        setMember(currentMember);
        setGarage(ensureList(savedGarage));
        setAppointments(ensureList(savedAppointments));
        setFeedPosts(ensureList(savedFeedPosts));
        setBenefitUsage(ensureList(savedBenefitUsage));
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

  useEffect(() => {
    if (!isBackendConfigured || !member?.id || mode !== "app") return undefined;

    let active = true;

    async function syncMembershipStatus() {
      try {
        const currentMember = await getCurrentMember();
        if (!active || !currentMember) return;

        if (hasMembershipAccess(currentMember.subscriptionStatus) && !hasMembershipAccess(member.subscriptionStatus)) {
          const [savedGarage, savedAppointments, savedFeedPosts, savedBenefitUsage] = await Promise.all([
            loadVehicles(currentMember.id),
            loadServiceRequests(currentMember.id),
            loadFeedPosts(),
            loadMembershipBenefitUsage(currentMember.id),
          ]);
          if (!active) return;
          setGarage(ensureList(savedGarage));
          setAppointments(ensureList(savedAppointments));
          setFeedPosts(ensureList(savedFeedPosts));
          setBenefitUsage(ensureList(savedBenefitUsage));
        } else if (!hasMembershipAccess(currentMember.subscriptionStatus) && hasMembershipAccess(member.subscriptionStatus)) {
          setGarage([]);
          setAppointments([]);
          setFeedPosts([]);
          setBenefitUsage([]);
        }

        setMember(currentMember);
      } catch (error) {
        console.warn("Could not refresh membership status.", error);
      }
    }

    function syncWhenVisible() {
      if (document.visibilityState === "visible") syncMembershipStatus();
    }

    const intervalId = window.setInterval(syncMembershipStatus, 30_000);
    window.addEventListener("focus", syncMembershipStatus);
    document.addEventListener("visibilitychange", syncWhenVisible);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", syncMembershipStatus);
      document.removeEventListener("visibilitychange", syncWhenVisible);
    };
  }, [member?.id, member?.subscriptionStatus, mode]);

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

  async function startSignupMembershipCheckout(signedInMember, profile) {
    if (!signedInMember?.id) {
      throw new Error("The account was created, but checkout could not start. Sign in after confirming your email and start membership activation.");
    }

    const accessToken = await getCurrentAccessToken();
    const response = await fetch(netlifyFunctionUrl("/.netlify/functions/create-membership-checkout-session"), {
      method: "POST",
      headers: {
        "Authorization": accessToken ? `Bearer ${accessToken}` : "",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        signupActivation: true,
        memberEmail: signedInMember.email || profile.email,
        memberName: signedInMember.name || profile.name,
        memberPhone: signedInMember.phone || profile.phone,
        plan: signedInMember.plan || profile.plan,
        userId: signedInMember.id,
      }),
    });
    const responseText = await response.text();
    let payload = {};
    try {
      payload = responseText ? JSON.parse(responseText) : {};
    } catch {
      payload = { error: responseText };
    }

    if (!response.ok || !payload.url) {
      throw new Error(readableError(payload.error || payload, "Could not start membership checkout. Check that Stripe and Supabase environment variables are set in Netlify."));
    }

    localStorage.setItem("whiteGlovePendingSignupEmail", signedInMember.email || profile.email || "");
    window.location.href = payload.url;
  }

  async function handleLogin(profile) {
    setAppError("");

    if (isBackendConfigured) {
      const signedInMember = profile.authAction === "create"
        ? await createAccount(profile)
        : await signIn(profile);
      if (profile.authAction === "create") {
        await startSignupMembershipCheckout(signedInMember, profile);
        return;
      }
      if (signedInMember.pendingConfirmation) {
        setAppError(`Account created for ${signedInMember.email}. Check your email to confirm your account, then sign in.`);
        return;
      }

      const [savedGarage, savedAppointments, savedFeedPosts, savedBenefitUsage] = await Promise.all([
        loadVehicles(signedInMember.id),
        loadServiceRequests(signedInMember.id),
        loadFeedPosts(),
        loadMembershipBenefitUsage(signedInMember.id),
      ]);

      setMember(signedInMember);
      setGarage(ensureList(savedGarage));
      setAppointments(ensureList(savedAppointments));
      setFeedPosts(ensureList(savedFeedPosts));
      setBenefitUsage(ensureList(savedBenefitUsage));
      setMode("app");
      return;
    }

    const localMember = { ...profile, subscriptionStatus: "active" };
    localStorage.setItem("carClubMember", JSON.stringify(localMember));
    localStorage.setItem("carClubGarage", JSON.stringify(garage));
    localStorage.setItem("carClubAppointments", JSON.stringify(appointments));
    setMember(localMember);
    setMode("app");
  }

  async function handleLogout() {
    await signOut();
    localStorage.removeItem("carClubMember");
    setMember(null);
    setBenefitUsage([]);
    setMode("site");
  }

  async function finishPasswordRecovery(message = "") {
    await signOut();
    window.history.replaceState({}, "", window.location.pathname);
    setMember(null);
    setAppError(message);
    setLoadingAccount(false);
    setMode("login");
  }

  async function refreshCurrentMember() {
    if (!isBackendConfigured) return member;

    const currentMember = await getCurrentMember();
    if (!currentMember) {
      setMember(null);
      setMode("login");
      return null;
    }

    setMember(currentMember);
    return currentMember;
  }

  const refreshMemberAppData = useCallback(async () => {
    if (!isBackendConfigured) {
      const storedGarage = ensureList(readStoredJson("carClubGarage", defaultGarage));
      const storedAppointments = ensureList(readStoredJson("carClubAppointments", defaultAppointments));
      const storedFeedPosts = ensureList(readStoredJson("carClubFeedPosts", []));
      const storedBenefitUsage = ensureList(readStoredJson("carClubBenefitUsage", []));
      setGarage(storedGarage);
      setAppointments(storedAppointments);
      setFeedPosts(storedFeedPosts);
      setBenefitUsage(storedBenefitUsage);
      return { appointments: storedAppointments, benefitUsage: storedBenefitUsage, feedPosts: storedFeedPosts, garage: storedGarage };
    }

    const currentMember = await getCurrentMember();
    if (!currentMember) {
      setMember(null);
      setMode("login");
      return null;
    }

    setMember(currentMember);

    if (!hasMembershipAccess(currentMember.subscriptionStatus)) {
      setGarage([]);
      setAppointments([]);
      setFeedPosts([]);
      setBenefitUsage([]);
      return { appointments: [], benefitUsage: [], feedPosts: [], garage: [] };
    }

    const [savedGarage, savedAppointments, savedFeedPosts, savedBenefitUsage] = await Promise.all([
      loadVehicles(currentMember.id),
      loadServiceRequests(currentMember.id),
      loadFeedPosts(),
      loadMembershipBenefitUsage(currentMember.id),
    ]);

    const nextGarage = ensureList(savedGarage);
    const nextAppointments = ensureList(savedAppointments);
    const nextFeedPosts = ensureList(savedFeedPosts);
    const nextBenefitUsage = ensureList(savedBenefitUsage);
    setGarage(nextGarage);
    setAppointments(nextAppointments);
    setFeedPosts(nextFeedPosts);
    setBenefitUsage(nextBenefitUsage);
    return { appointments: nextAppointments, benefitUsage: nextBenefitUsage, feedPosts: nextFeedPosts, garage: nextGarage };
  }, []);

  async function handleUpdateMember(settings) {
    const nextPlan = member?.plan || "Club Drive";

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

    if (hasOpenMatchingServiceRequest(appointments, appointment)) {
      throw new Error(`You already have an open ${appointment.service} request for ${appointment.vehicle}. Wait until it is approved before booking that same service again.`);
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

  async function updateAppointment(appointmentId, updates) {
    const currentAppointment = appointments.find((appointment) => appointment.id === appointmentId);
    if (!currentAppointment) throw new Error("Could not find that service request.");
    if (!isFutureServiceDate(currentAppointment.date)) {
      throw new Error("Same-day service requests are locked. Contact the concierge for urgent changes.");
    }

    if (isBackendConfigured && member?.id) {
      const savedRequest = await updateServiceRequestRecord(appointmentId, updates);
      setAppointments((currentAppointments) => currentAppointments.map((appointment) => (appointment.id === appointmentId ? savedRequest : appointment)));
      return savedRequest;
    }

    const nextAppointments = appointments.map((appointment) => (appointment.id === appointmentId ? { ...appointment, ...updates } : appointment));
    localStorage.setItem("carClubAppointments", JSON.stringify(nextAppointments));
    setAppointments(nextAppointments);
    return nextAppointments.find((appointment) => appointment.id === appointmentId);
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
    return <LoginScreen appError={appError} backendEnabled={isBackendConfigured} membershipPricing={membershipPricing} onForgotPassword={requestPasswordReset} onLogin={handleLogin} onBack={() => setMode("site")} />;
  }

  if (mode === "signup-confirmation") {
    return <SignupConfirmationScreen email={signupConfirmationEmail} onBack={() => setMode("site")} onSignIn={() => { setAppError(""); setMode("login"); }} />;
  }

  if (mode === "password-recovery") {
    return <PasswordRecoveryScreen onCancel={() => finishPasswordRecovery()} onComplete={() => finishPasswordRecovery("Your password has been changed. Sign in with your new password.")} />;
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
    if (!hasMembershipAccess(member.subscriptionStatus)) {
      return (
        <SubscriptionActivationScreen
          appError={appError}
          member={member}
          membershipPricing={membershipPricing}
          onBack={() => setMode("site")}
          onLogout={handleLogout}
          onRefreshMember={refreshCurrentMember}
        />
      );
    }

    return <MemberApp appointments={appointments} benefitUsage={benefitUsage} feedPosts={feedPosts} garage={garage} initialCompletion={checkoutCompletion} member={member} onAddAppointment={addAppointment} onAddFeedPost={addFeedPost} onAddVehicle={addVehicle} onDeleteVehicle={deleteVehicle} onLogout={handleLogout} onRefreshFeedPosts={refreshFeedPosts} onRefreshMemberAppData={refreshMemberAppData} onUpdateAppointment={updateAppointment} onUpdateMember={handleUpdateMember} onUpdateVehicle={updateVehicle} servicePricing={servicePricing} />;
  }

  if (mode === "app") {
    return <LoginScreen appError="Please sign in to access your member app." backendEnabled={isBackendConfigured} membershipPricing={membershipPricing} onForgotPassword={requestPasswordReset} onLogin={handleLogin} onBack={() => setMode("site")} />;
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
          <button className="nav-button profile-nav-button" type="button" onClick={openMemberAccess}>
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
              <button className="button primary" type="button" onClick={openMemberAccess}>
                {memberAccessLabel} <ArrowRight size={18} />
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
                  <strong>{membershipPriceLabel(plan.name, membershipPricing)}</strong>
                  <span>{membershipPricingForPlan(plan.name, membershipPricing).cadence}</span>
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
            <h2>Built for collectors, busy owners, and companies with 2 to 100 vehicles.</h2>
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
          <button type="button" onClick={openMemberAccess}>Open Member App</button>
        </div>
      </footer>
      {memberAccessChoiceOpen && (
        <div className="member-access-modal" role="dialog" aria-modal="true" aria-labelledby="member-access-title">
          <section className="member-access-card">
            <button className="icon-button modal-close-button" type="button" onClick={() => setMemberAccessChoiceOpen(false)} aria-label="Close">
              <X size={20} />
            </button>
            <p className="eyebrow">White Glove member app</p>
            <h2 id="member-access-title">How would you like to open it?</h2>
            <p>Stay on the web member portal, or open White Glove Concierge in the App Store.</p>
            <div className="member-access-actions">
              <button className="button primary" type="button" onClick={continueMemberAccessOnWeb}>
                Stay On Web
              </button>
              <button className="button secondary" type="button" onClick={openMemberAccessInStore}>
                Open App Store
              </button>
            </div>
          </section>
        </div>
      )}
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

function AdminServicePricingEditor({ onSave, pricing }) {
  return (
    <section className="admin-pricing-card">
      <div className="admin-pricing-heading">
        <div>
          <p className="eyebrow">Booking price settings</p>
          <h2>Service request prices</h2>
          <p>Change a service price once here. Every member will see the same deposit, full payment, or free request setting on future bookings.</p>
        </div>
        <span>{serviceOptions.length} services</span>
      </div>
      <div className="admin-pricing-list">
        {serviceOptions.map((service) => (
          <AdminServicePriceRow key={service.label} onSave={onSave} pricing={pricing?.[service.label]} service={service} />
        ))}
      </div>
    </section>
  );
}

function AdminServicePriceRow({ onSave, pricing, service }) {
  const fallback = defaultPricingForService(service.label);
  const [amount, setAmount] = useState(((pricing?.amountCents ?? fallback.amountCents) / 100).toString());
  const [note, setNote] = useState(pricing?.note || fallback.note || "");
  const [paymentMode, setPaymentMode] = useState(pricing?.paymentMode || fallback.paymentMode || "deposit");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const nextFallback = defaultPricingForService(service.label);
    setAmount(((pricing?.amountCents ?? nextFallback.amountCents) / 100).toString());
    setNote(pricing?.note || nextFallback.note || "");
    setPaymentMode(pricing?.paymentMode || nextFallback.paymentMode || "deposit");
  }, [pricing?.amountCents, pricing?.note, pricing?.paymentMode, service.label]);

  async function submitPricing(event) {
    event.preventDefault();
    setSaving(true);

    try {
      await onSave(service.label, {
        amountCents: paymentMode === "free" ? 0 : Math.round(Number(amount || 0) * 100),
        note,
        paymentMode,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="admin-pricing-row" onSubmit={submitPricing}>
      <div className="admin-pricing-service">
        <strong>{service.label}</strong>
        <small>{pricing ? "Saved global price" : "Default price until saved"}</small>
      </div>
      <label>
        Payment type
        <select value={paymentMode} onChange={(event) => setPaymentMode(event.target.value)}>
          <option value="deposit">Security deposit</option>
          <option value="full">Pay in full</option>
          <option value="free">Free request</option>
        </select>
      </label>
      <label>
        Amount CAD
        <input
          disabled={paymentMode === "free"}
          min="0"
          onChange={(event) => setAmount(event.target.value)}
          step="0.01"
          type="number"
          value={amount}
        />
      </label>
      <label>
        Checkout note
        <input
          onChange={(event) => setNote(event.target.value)}
          placeholder="Applied to final invoice..."
          type="text"
          value={note}
        />
      </label>
      <button className="button secondary compact-button" type="submit" disabled={saving}>
        {saving ? "Saving..." : "Save"}
      </button>
    </form>
  );
}

function AdminMembershipPricingEditor({ membershipPricing, onSave }) {
  return (
    <section className="admin-pricing-card">
      <div className="admin-pricing-heading">
        <div>
          <p className="eyebrow">Membership price settings</p>
          <h2>Subscription prices</h2>
          <p>Change the monthly membership price once here. New member checkouts and website membership cards will use the updated price.</p>
        </div>
        <span>{plans.length} plans</span>
      </div>
      <div className="admin-pricing-list">
        {plans.map((plan) => (
          <AdminMembershipPriceRow key={plan.name} membershipPricing={membershipPricing?.[plan.name]} onSave={onSave} plan={plan} />
        ))}
      </div>
    </section>
  );
}

function AdminMembershipPriceRow({ membershipPricing, onSave, plan }) {
  const fallback = defaultMembershipPricingForPlan(plan.name);
  const initialAmountCents = membershipPricing?.amountCents ?? fallback.amountCents;
  const [amount, setAmount] = useState(initialAmountCents === null || initialAmountCents === undefined ? "" : (initialAmountCents / 100).toString());
  const [cadence, setCadence] = useState(membershipPricing?.cadence || fallback.cadence || "/month");
  const [note, setNote] = useState(membershipPricing?.note || fallback.note || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const nextFallback = defaultMembershipPricingForPlan(plan.name);
    const nextAmountCents = membershipPricing?.amountCents ?? nextFallback.amountCents;
    setAmount(nextAmountCents === null || nextAmountCents === undefined ? "" : (nextAmountCents / 100).toString());
    setCadence(membershipPricing?.cadence || nextFallback.cadence || "/month");
    setNote(membershipPricing?.note || nextFallback.note || "");
  }, [membershipPricing?.amountCents, membershipPricing?.cadence, membershipPricing?.note, plan.name]);

  async function submitPricing(event) {
    event.preventDefault();
    setSaving(true);

    try {
      await onSave(plan.name, {
        amountCents: amount === "" ? null : Math.max(0, Math.round(Number(amount || 0) * 100)),
        cadence,
        note,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="admin-pricing-row membership-pricing-row" onSubmit={submitPricing}>
      <div className="admin-pricing-service">
        <strong>{plan.name}</strong>
        <small>{membershipPricing ? "Saved global price" : "Default price until saved"}</small>
      </div>
      <label>
        Amount CAD
        <input
          min="0"
          onChange={(event) => setAmount(event.target.value)}
          placeholder={plan.price === "Custom" ? "Set a price" : "0"}
          step="0.01"
          type="number"
          value={amount}
        />
      </label>
      <label>
        Billing
        <select value={cadence} onChange={(event) => setCadence(event.target.value)}>
          <option value="/month">Monthly</option>
          <option value="/year">Yearly</option>
        </select>
      </label>
      <label>
        Website note
        <input
          onChange={(event) => setNote(event.target.value)}
          placeholder="Shown internally with this price"
          type="text"
          value={note}
        />
      </label>
      <button className="button secondary compact-button" type="submit" disabled={saving}>
        {saving ? "Saving..." : "Save"}
      </button>
    </form>
  );
}

function AdminBenefitControls({ onUpdate, request }) {
  const activeUsage = ensureList(request.benefit_usage).filter((usage) => usage.status === "redeemed");
  const benefitKeys = [...new Set([
    ...suggestedBenefitKeysForRequest(request),
    ...activeUsage.map((usage) => usage.benefit_key),
  ])];

  if (!benefitKeys.length) return null;

  return (
    <div className="admin-benefit-controls">
      <div>
        <Gift size={18} />
        <strong>Included benefits</strong>
        <span>Apply a credit only after confirming it with the member.</span>
      </div>
      <div className="admin-benefit-actions">
        {benefitKeys.map((benefitKey) => {
          const catalogItem = membershipBenefitCatalog[benefitKey];
          const balance = ensureList(request.member_benefits).find((benefit) => benefit.key === benefitKey);
          const applied = activeUsage.some((usage) => usage.benefit_key === benefitKey);
          if (!catalogItem || (!balance && !applied)) return null;

          return (
            <button
              className={applied ? "benefit-applied" : ""}
              disabled={!applied && (!balance || balance.remaining <= 0)}
              key={benefitKey}
              onClick={() => onUpdate(request.id, benefitKey, applied ? "restore-benefit" : "redeem-benefit")}
              type="button"
            >
              {applied
                ? `Restore ${catalogItem.shortLabel}`
                : `${catalogItem.shortLabel}: use 1 (${balance.remaining} left)`}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function AdminPortal({ onBack }) {
  const [adminToken, setAdminToken] = useState("");
  const [draftToken, setDraftToken] = useState(() => localStorage.getItem("whiteGloveAdminToken") || "");
  const [adminError, setAdminError] = useState("");
  const [adminNotice, setAdminNotice] = useState("");
  const [adminMenu, setAdminMenu] = useState("requests");
  const [adminSidebarOpen, setAdminSidebarOpen] = useState(false);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [membershipPricing, setMembershipPricing] = useState({});
  const [servicePricing, setServicePricing] = useState({});
  const [serviceRequests, setServiceRequests] = useState([]);

  async function loadAdminRequests(token = adminToken, options = {}) {
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
      if (options.throwOnError) throw error;
    } finally {
      setLoadingRequests(false);
    }
  }

  async function loadAdminPricing(token = adminToken, options = {}) {
    if (!token) return;
    if (!options.keepNotice) setAdminNotice("");

    try {
      const response = await fetch("/.netlify/functions/admin-service-pricing", {
        headers: { "x-admin-token": token },
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error || "Could not load service pricing.");
      }

      setServicePricing(normalizeServicePricingRows(payload.pricing || []));
    } catch (error) {
      const message = error.message || "Could not load service pricing.";
      if (options.throwOnError) {
        setAdminError(message);
        throw error;
      }
      setAdminNotice(`${message} Service Requests still work. Run the Supabase pricing SQL before using Booking Price Settings.`);
    }
  }

  async function loadAdminMembershipPricing(token = adminToken, options = {}) {
    if (!token) return;
    if (!options.keepNotice) setAdminNotice("");

    try {
      const response = await fetch("/.netlify/functions/admin-membership-pricing", {
        headers: { "x-admin-token": token },
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error || "Could not load membership pricing.");
      }

      setMembershipPricing(normalizeMembershipPricingRows(payload.pricing || []));
    } catch (error) {
      const message = error.message || "Could not load membership pricing.";
      if (options.throwOnError) {
        setAdminError(message);
        throw error;
      }
      setAdminNotice(`${message} Run the Supabase membership SQL before using Subscription Price Settings.`);
    }
  }

  async function submitAdminLogin(event) {
    event.preventDefault();
    setAdminError("");
    setAdminNotice("");

    try {
      await loadAdminRequests(draftToken, { throwOnError: true });
      localStorage.setItem("whiteGloveAdminToken", draftToken);
      setAdminToken(draftToken);
      setAdminMenu("requests");
      setAdminSidebarOpen(false);
      loadAdminPricing(draftToken, { keepNotice: true });
      loadAdminMembershipPricing(draftToken, { keepNotice: true });
    } catch (error) {
      localStorage.removeItem("whiteGloveAdminToken");
      setAdminToken("");
      setAdminError(error.message || "That password did not open the admin portal.");
    }
  }

  function closeAdminPortal() {
    localStorage.removeItem("whiteGloveAdminToken");
    setAdminToken("");
    setDraftToken("");
    setAdminMenu("requests");
    setAdminSidebarOpen(false);
    setServiceRequests([]);
    setServicePricing({});
    setMembershipPricing({});
    setAdminNotice("");
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

  async function updateDemandBenefit(id, benefitKey, action) {
    setAdminError("");
    setAdminNotice("");

    try {
      const response = await fetch("/.netlify/functions/admin-service-requests", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": adminToken,
        },
        body: JSON.stringify({ action, benefitKey, id }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error || "Could not update the member benefit.");
      }

      await loadAdminRequests(adminToken);
      setAdminNotice(action === "restore-benefit" ? "The benefit was restored to the member's balance." : "The benefit was recorded in the member's annual balance.");
    } catch (error) {
      setAdminError(error.message || "Could not update the member benefit.");
    }
  }

  async function updateServicePrice(serviceLabel, pricingUpdate) {
    setAdminError("");

    try {
      const response = await fetch("/.netlify/functions/admin-service-pricing", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": adminToken,
        },
        body: JSON.stringify({ serviceLabel, ...pricingUpdate }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error || "Could not update service pricing.");
      }

      setServicePricing((currentPricing) => ({
        ...currentPricing,
        ...normalizeServicePricingRows([payload.pricing]),
      }));
    } catch (error) {
      setAdminError(error.message || "Could not update service pricing.");
    }
  }

  async function updateMembershipPrice(planName, pricingUpdate) {
    setAdminError("");

    try {
      const response = await fetch("/.netlify/functions/admin-membership-pricing", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": adminToken,
        },
        body: JSON.stringify({ planName, ...pricingUpdate }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error || "Could not update membership pricing.");
      }

      setMembershipPricing((currentPricing) => ({
        ...currentPricing,
        ...normalizeMembershipPricingRows([payload.pricing]),
      }));
    } catch (error) {
      setAdminError(error.message || "Could not update membership pricing.");
    }
  }

  const adminNavigation = [
    { id: "requests", label: "Service Requests" },
    { id: "pricing", label: "Booking Price Settings" },
    { id: "memberships", label: "Subscription Price Settings" },
  ];

  if (!adminToken) {
    return (
      <main className="admin-portal admin-portal-locked">
        <section className="admin-login-shell">
          <div className="admin-login-intro">
            <p className="eyebrow">White Glove backend</p>
            <h1>Admin Portal</h1>
            <p>Enter the admin password to view service requests, booking details, and price settings.</p>
          </div>

          <form className="admin-login-card admin-login-card-locked" onSubmit={submitAdminLogin}>
            <label>
              Admin password
              <input type="password" value={draftToken} onChange={(event) => setDraftToken(event.target.value)} placeholder="Enter backend portal password" />
            </label>
            <button className="button primary compact-button" type="submit" disabled={loadingRequests || !draftToken.trim()}>
              <KeyRound size={18} /> {loadingRequests ? "Opening..." : "Open Portal"}
            </button>
            <button className="button secondary compact-button" type="button" onClick={onBack}>Back To Website</button>
          </form>

          {adminError && <div className="error-message">{adminError}</div>}
        </section>
      </main>
    );
  }

  return (
    <main className="admin-portal">
      <section className="admin-shell">
        <div className="admin-header">
          <button className="admin-menu-button" type="button" onClick={() => setAdminSidebarOpen((isOpen) => !isOpen)} aria-label="Open admin menu">
            {adminSidebarOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
          <div>
            <p className="eyebrow">White Glove backend</p>
            <h1>{adminMenu === "memberships" ? "Subscription Price Settings" : adminMenu === "pricing" ? "Booking Price Settings" : "Service Requests"}</h1>
            <p>
              {adminMenu === "memberships"
                ? "Set the membership prices used for new account activation checkouts."
                : adminMenu === "pricing"
                  ? "Set the same service request price for every member."
                  : "Review paid bookings, member service requests, preferred timing, vehicle details, and concierge status."}
            </p>
          </div>
          <div className="admin-header-actions">
            <button className="button secondary compact-button" type="button" onClick={() => { loadAdminRequests(adminToken); loadAdminPricing(adminToken); loadAdminMembershipPricing(adminToken); }} disabled={loadingRequests}>
              {loadingRequests ? "Loading..." : "Refresh"}
            </button>
            <button className="button secondary compact-button" type="button" onClick={closeAdminPortal}>Log Out</button>
            <button className="button secondary compact-button" type="button" onClick={onBack}>Back To Website</button>
          </div>
        </div>

        {adminSidebarOpen && (
          <aside className="admin-sidebar" aria-label="Admin menu">
            {adminNavigation.map((item) => (
              <button
                className={adminMenu === item.id ? "active" : ""}
                key={item.id}
                onClick={() => {
                  setAdminMenu(item.id);
                  setAdminSidebarOpen(false);
                }}
                type="button"
              >
                {item.label}
              </button>
            ))}
          </aside>
        )}

        {adminError && <div className="error-message">{adminError}</div>}
        {adminNotice && <div className="admin-notice">{adminNotice}</div>}

        {adminMenu === "pricing" && <AdminServicePricingEditor onSave={updateServicePrice} pricing={servicePricing} />}
        {adminMenu === "memberships" && <AdminMembershipPricingEditor membershipPricing={membershipPricing} onSave={updateMembershipPrice} />}

        {adminMenu === "requests" && (
          <div className="admin-request-grid">
            {serviceRequests.length === 0 ? (
              <article className="admin-empty-card">
                <h2>No service requests yet</h2>
                <p>New bookings and service requests will appear here.</p>
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
                  {request.notes && <pre>{request.notes}</pre>}
                  <AdminBenefitControls onUpdate={updateDemandBenefit} request={request} />
                  <div className="admin-status-actions">
                    {["Requested", "In Review", "Approved", "Booked", "Paid / Confirmed", "Completed"].map((status) => (
                      <button key={status} type="button" onClick={() => updateDemandStatus(request.id, status)}>
                        {status}
                      </button>
                    ))}
                  </div>
                </article>
              ))
            )}
          </div>
        )}
      </section>
    </main>
  );
}

function LoginScreen({ appError, backendEnabled, membershipPricing, onBack, onForgotPassword, onLogin }) {
  const [authMode, setAuthMode] = useState("signin");
  const [signupAddresses, setSignupAddresses] = useState([{ id: "primary-address", label: "Home" }]);
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authNotice, setAuthNotice] = useState("");
  const formRef = useRef(null);
  const appErrorIsNotice = appError?.startsWith("Account created.") || appError?.startsWith("Your password has been changed.");

  async function submitLogin(event) {
    event.preventDefault();
    setAuthError("");
    setAuthNotice("");
    setAuthLoading(true);

    const formData = new FormData(event.currentTarget);
    const authAction = authMode === "create" ? "create" : "signin";
    const addresses = signupAddresses
      .map((address) => ({
        label: formData.get(`addressLabel-${address.id}`) || address.label,
        address: formData.get(`addressValue-${address.id}`) || "",
      }))
      .filter((address) => address.address);

    try {
      await onLogin({
        authAction,
        name: formData.get("name") || "Member",
        email: formData.get("email") || "member@example.com",
        password: formData.get("password"),
        phone: formData.get("phone") || "",
        plan: formData.get("plan") || "Club Drive",
        addresses,
      });
    } catch (error) {
      setAuthError(readableError(error, "Could not access your account."));
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleResendConfirmation() {
    setAuthError("");
    setAuthNotice("");

    const emailInput = formRef.current?.elements?.email;
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

  async function handleForgotPassword() {
    setAuthError("");
    setAuthNotice("");

    const emailInput = formRef.current?.elements?.email;
    const email = emailInput?.value?.trim();

    if (!email) {
      setAuthError("Enter your email first, then choose Forgot your password.");
      emailInput?.focus();
      return;
    }

    if (!emailInput.checkValidity()) {
      emailInput.reportValidity();
      return;
    }

    try {
      setAuthLoading(true);
      await onForgotPassword(email);
      setAuthNotice("If an account exists for that email, a password reset link is on its way. Check your inbox and spam folder.");
    } catch (error) {
      setAuthError(error.message || "Could not send the password reset email.");
    } finally {
      setAuthLoading(false);
    }
  }

  function showAuthMode(nextMode) {
    setAuthMode(nextMode);
    setAuthError("");
    setAuthNotice("");
  }

  function addSignupAddress() {
    setSignupAddresses((addresses) => [...addresses, { id: crypto.randomUUID(), label: "Other" }]);
  }

  function removeSignupAddress(addressId) {
    setSignupAddresses((addresses) => (addresses.length > 1 ? addresses.filter((address) => address.id !== addressId) : addresses));
  }

  return (
    <main className="login-screen">
      <section className="phone-auth">
        <button className="text-button" type="button" onClick={onBack}>Back to site</button>
        <div className="auth-brand">
          <span className="brand-mark">WG</span>
          <span>White Glove Member App</span>
        </div>
        <h1>{authMode === "create" ? "Create your member account." : "Sign in to your member account."}</h1>
        <p>{backendEnabled ? authMode === "create" ? "Choose your package, create your account, then continue to secure membership payment." : "Use your member email and password to access saved vehicles and service requests." : "Backend keys are not connected yet, so this runs in local prototype mode."}</p>
        <div className="auth-mode-switch" aria-label="Account access options">
          <button className={authMode === "signin" ? "active" : ""} type="button" onClick={() => showAuthMode("signin")}>Sign In</button>
          <button className={authMode === "create" ? "active" : ""} type="button" onClick={() => showAuthMode("create")}>Create Account</button>
        </div>
        <form className="app-form" ref={formRef} onSubmit={submitLogin}>
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
          {authMode === "create" && (
            <>
              <label>
                Full name
                <input name="name" type="text" placeholder="Full name" required />
              </label>
              <label>
                Phone number
                <input name="phone" type="tel" autoComplete="tel" placeholder="Phone number" required />
              </label>
              <label>
                Membership
                <select name="plan" required>
                  {plans.map((plan) => (
                    <option key={plan.name} value={plan.name}>
                      {plan.name} - {membershipPriceLabel(plan.name, membershipPricing)}{membershipPricingForPlan(plan.name, membershipPricing).cadence}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
          <label>
            Email
            <input name="email" type="email" placeholder="email@example.com" required />
          </label>
          <label>
            Password
            <input name="password" type="password" minLength="6" placeholder="Minimum 6 characters" required />
          </label>
          {authMode === "signin" && (
            <button className="forgot-password-button" type="button" onClick={handleForgotPassword} disabled={authLoading || !backendEnabled}>
              Forgot your password?
            </button>
          )}
          {authMode === "create" && (
            <div className="signup-address-list">
              <div className="signup-address-header">
                <span>Saved addresses</span>
                <button className="icon-button" type="button" onClick={addSignupAddress} aria-label="Add address">
                  <Plus size={18} />
                </button>
              </div>
              {signupAddresses.map((address, index) => (
                <div className="signup-address-row" key={address.id}>
                  <label>
                    Type
                    <select name={`addressLabel-${address.id}`} defaultValue={address.label}>
                      <option>Home</option>
                      <option>Work</option>
                      <option>Storage</option>
                      <option>Dealership</option>
                      <option>Other</option>
                    </select>
                  </label>
                  <label>
                    Address
                    <input name={`addressValue-${address.id}`} type="text" placeholder="Street address, city, province/state" required={index === 0} />
                  </label>
                  <button className="icon-button" type="button" onClick={() => removeSignupAddress(address.id)} aria-label="Remove address" disabled={signupAddresses.length === 1}>
                    <X size={18} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <button className="button primary submit" type="submit" disabled={authLoading}>
            {authLoading ? "Working..." : authMode === "create" ? "Create Account & Continue To Payment" : "Sign In"} <ArrowRight size={18} />
          </button>
          {authMode === "signin" && (
            <button className="button ghost submit" type="button" onClick={handleResendConfirmation} disabled={authLoading || !backendEnabled}>
              Resend Confirmation Email
            </button>
          )}
        </form>
      </section>
    </main>
  );
}

function SignupConfirmationScreen({ email, onBack, onSignIn }) {
  return (
    <main className="login-screen">
      <section className="phone-auth signup-confirmation-card">
        <button className="text-button" type="button" onClick={onBack}>Back to site</button>
        <div className="auth-brand">
          <span className="brand-mark">WG</span>
          <span>White Glove Member App</span>
        </div>
        <div className="completion-mark">
          <Check size={36} />
        </div>
        <h1>Your membership is almost ready.</h1>
        <p>
          Payment is complete. Confirm your email{email ? ` at ${email}` : ""} to finish activating your account, then sign in with the password you created.
        </p>
        <div className="success-message" role="status">
          Open your inbox and look for the White Glove confirmation email. If it is not there, check spam or promotions.
        </div>
        <button className="button primary submit" type="button" onClick={onSignIn}>
          Go To Sign In <ArrowRight size={18} />
        </button>
      </section>
    </main>
  );
}

function PasswordRecoveryScreen({ onCancel, onComplete }) {
  const [recoveryError, setRecoveryError] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  async function submitNewPassword(event) {
    event.preventDefault();
    setRecoveryError("");

    const formData = new FormData(event.currentTarget);
    const password = String(formData.get("password") || "");
    const confirmation = String(formData.get("passwordConfirmation") || "");

    if (password !== confirmation) {
      setRecoveryError("The passwords do not match.");
      return;
    }

    try {
      setSavingPassword(true);
      await updateMemberPassword(password);
      await onComplete();
    } catch (error) {
      setRecoveryError(error.message || "Could not change your password. Request a new reset email and try again.");
      setSavingPassword(false);
    }
  }

  return (
    <main className="login-screen">
      <section className="phone-auth">
        <button className="text-button" type="button" onClick={onCancel} disabled={savingPassword}>Back to sign in</button>
        <div className="auth-brand">
          <span className="brand-mark">WG</span>
          <span>White Glove Member App</span>
        </div>
        <KeyRound size={28} />
        <h1>Choose a new password.</h1>
        <p>Enter a new password for your member account. You’ll return to sign in after it is saved.</p>
        <form className="app-form" onSubmit={submitNewPassword}>
          {recoveryError && <div className="error-message" role="alert">{recoveryError}</div>}
          <label>
            New password
            <input name="password" type="password" minLength="6" autoComplete="new-password" placeholder="Minimum 6 characters" required />
          </label>
          <label>
            Confirm new password
            <input name="passwordConfirmation" type="password" minLength="6" autoComplete="new-password" placeholder="Enter it again" required />
          </label>
          <button className="button primary submit" type="submit" disabled={savingPassword}>
            {savingPassword ? "Saving password..." : "Change Password"} <ArrowRight size={18} />
          </button>
        </form>
      </section>
    </main>
  );
}

function SubscriptionActivationScreen({ appError, member, membershipPricing, onBack, onLogout, onRefreshMember }) {
  const [selectedPlan, setSelectedPlan] = useState(member?.plan || "Club Drive");
  const [activationError, setActivationError] = useState("");
  const [activationNotice, setActivationNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const lifecycleContent = membershipLifecycleContent(member?.subscriptionStatus);
  const selectedPricing = membershipPricingForPlan(selectedPlan, membershipPricing);
  const hasCheckoutPrice = selectedPricing.amountCents !== null && selectedPricing.amountCents !== undefined && selectedPricing.amountCents > 0;
  const canCheckout = lifecycleContent.canStartCheckout && hasCheckoutPrice;

  async function startMembershipCheckout() {
    setActivationError("");
    setActivationNotice("");

    if (!lifecycleContent.canStartCheckout) {
      setActivationError("Resolve the existing subscription balance through Stripe before starting another membership.");
      return;
    }

    if (!hasCheckoutPrice) {
      setActivationError("This membership needs a price set in the admin portal before online activation can be used.");
      return;
    }

    try {
      setLoading(true);
      const accessToken = await getCurrentAccessToken();
      const response = await fetch(netlifyFunctionUrl("/.netlify/functions/create-membership-checkout-session"), {
        method: "POST",
        headers: {
          "Authorization": accessToken ? `Bearer ${accessToken}` : "",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          memberEmail: member.email,
          memberName: member.name,
          plan: selectedPlan,
          userId: member.id,
        }),
      });
      const responseText = await response.text();
      let payload = {};
      try {
        payload = responseText ? JSON.parse(responseText) : {};
      } catch {
        payload = { error: responseText };
      }

      if (!response.ok || !payload.url) {
        throw new Error(readableError(payload.error || payload, "Could not start membership checkout."));
      }

      window.location.href = payload.url;
    } catch (error) {
      setActivationError(readableError(error, "Could not start membership checkout."));
      setLoading(false);
    }
  }

  async function checkMembership() {
    setActivationError("");
    setActivationNotice("");
    setLoading(true);

    try {
      const refreshedMember = await onRefreshMember?.();
      if (hasMembershipAccess(refreshedMember?.subscriptionStatus)) {
        setActivationNotice("Membership is active. Opening your account.");
        return;
      }
      const refreshedContent = membershipLifecycleContent(refreshedMember?.subscriptionStatus);
      setActivationNotice(`Stripe still reports this membership as ${String(refreshedMember?.subscriptionStatus || "pending").replaceAll("_", " ")}. ${refreshedContent.description}`);
    } catch (error) {
      setActivationError(error.message || "Could not check membership status.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-screen subscription-screen">
      <section className="subscription-activation">
        <button className="text-button" type="button" onClick={onBack}>Back to site</button>
        <div className="auth-brand">
          <span className="brand-mark">WG</span>
          <span>White Glove Member App</span>
        </div>
        <p className="eyebrow">{lifecycleContent.eyebrow}</p>
        <h1>{lifecycleContent.title}</h1>
        <p>{lifecycleContent.description}</p>

        {appError && (
          <div className={appError.toLowerCase().includes("cancelled") ? "error-message" : "success-message"} role="status">
            {appError}
          </div>
        )}
        {activationError && <div className="error-message" role="alert">{activationError}</div>}
        {activationNotice && <div className="success-message" role="status">{activationNotice}</div>}

        {lifecycleContent.canStartCheckout && (
          <>
            <div className="subscription-plan-grid">
              {plans.map((plan) => {
                const pricing = membershipPricingForPlan(plan.name, membershipPricing);
                const isSelected = selectedPlan === plan.name;
                return (
                  <button
                    className={isSelected ? "subscription-plan selected" : "subscription-plan"}
                    key={plan.name}
                    onClick={() => setSelectedPlan(plan.name)}
                    type="button"
                  >
                    <span>{plan.name}</span>
                    <strong>{membershipPriceLabel(plan.name, membershipPricing)}{pricing.cadence}</strong>
                    <small>{plan.intro}</small>
                  </button>
                );
              })}
            </div>

            <div className="subscription-summary">
              <div>
                <span>Selected membership</span>
                <strong>{selectedPlan}</strong>
              </div>
              <div>
                <span>Due today</span>
                <strong>{hasCheckoutPrice ? `${membershipPriceLabel(selectedPlan, membershipPricing)}${selectedPricing.cadence}` : "Custom"}</strong>
              </div>
            </div>
          </>
        )}

        <div className="subscription-actions">
          {lifecycleContent.canStartCheckout && (
            <button className="button primary submit" type="button" onClick={startMembershipCheckout} disabled={loading || !canCheckout}>
              {loading ? "Opening checkout..." : member?.subscriptionStatus === "canceled" ? "Reactivate With Stripe" : "Activate With Stripe"} <ArrowRight size={18} />
            </button>
          )}
          <button className={lifecycleContent.canStartCheckout ? "button secondary submit" : "button primary submit"} type="button" onClick={checkMembership} disabled={loading}>
            {loading ? "Checking..." : "Check Membership Status"}
          </button>
          <button className="button ghost submit" type="button" onClick={onLogout} disabled={loading}>
            Log Out
          </button>
        </div>
      </section>
    </main>
  );
}

function MemberApp({ appointments, benefitUsage, feedPosts, garage, initialCompletion, member, onAddAppointment, onAddFeedPost, onAddVehicle, onDeleteVehicle, onLogout, onRefreshFeedPosts, onRefreshMemberAppData, onUpdateAppointment, onUpdateMember, onUpdateVehicle, servicePricing }) {
  const [activeTab, setActiveTab] = useState("home");
  const [completion, setCompletion] = useState(null);
  const [tabRefreshKey, setTabRefreshKey] = useState(0);
  const appMainRef = useRef(null);
  const garageList = ensureList(garage).map(normalizeVehicle);
  const appointmentList = ensureList(appointments);
  const benefitSummary = useMemo(() => summarizeMembershipBenefits(member.plan, ensureList(benefitUsage)), [benefitUsage, member.plan]);
  const vehicleOptions = useMemo(() => garageList.map((vehicle) => `${vehicle.year || ""} ${vehicle.make || ""} ${vehicle.model || ""}`.trim() || "Garage vehicle"), [garageList]);
  const firstName = member.name?.split(" ")[0] || "Member";
  const navigateToTab = (tab) => {
    setCompletion(null);
    setActiveTab(tab);
    setTabRefreshKey((key) => key + 1);

    window.requestAnimationFrame(() => {
      appMainRef.current?.scrollTo?.({ top: 0, behavior: "smooth" });
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

    onRefreshMemberAppData?.().catch(() => {});
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

      <main className="app-main" ref={appMainRef}>
        <header className="app-topbar">
          <div>
            <p className="eyebrow">Member app</p>
            <h1>{completion ? "Successfully Updated" : activeTab === "home" ? `Welcome, ${firstName}` : tabTitle(activeTab)}</h1>
          </div>
          <button className="icon-button profile-settings-button" type="button" aria-label="Profile settings" onClick={() => navigateToTab("account")}>
            <ProfileAvatar member={member} size={32} />
          </button>
        </header>

        {member.subscriptionCancelAtPeriodEnd && (
          <div className="subscription-lifecycle-notice" role="status">
            <strong>Your membership is scheduled to end.</strong>
            <span>You can keep using the member app until Stripe closes the subscription. Contact White Glove if you want to keep it active.</span>
          </div>
        )}

        <MemberPanelErrorBoundary resetKey={`${activeTab}-${tabRefreshKey}`} onRecover={() => setActiveTab("home")}>
          <div key={`${activeTab}-${tabRefreshKey}`}>
            {completion && <CompletionScreen completion={completion} onNavigate={navigateToTab} />}
            {!completion && activeTab === "home" && (
              <Dashboard
                appointments={appointmentList}
                benefitSummary={benefitSummary}
                feedPosts={feedPosts}
                garage={garageList}
                member={member}
                onUpdateAppointment={onUpdateAppointment}
                setActiveTab={navigateToTab}
              />
            )}
            {!completion && activeTab === "garage" && <GarageScreen appointments={appointmentList} garage={garageList} member={member} onAddAppointment={onAddAppointment} onAddVehicle={onAddVehicle} onDeleteVehicle={onDeleteVehicle} onUpdateVehicle={onUpdateVehicle} onComplete={setCompletion} />}
            {!completion && activeTab === "schedule" && <ScheduleScreen appointments={appointmentList} benefitSummary={benefitSummary} garage={garageList} member={member} onAddAppointment={onAddAppointment} onComplete={setCompletion} onUpdateAppointment={onUpdateAppointment} servicePricing={servicePricing} setActiveTab={navigateToTab} vehicleOptions={vehicleOptions} />}
            {!completion && activeTab === "feed" && <FeedScreen feedPosts={feedPosts} member={member} onAddFeedPost={onAddFeedPost} onComplete={setCompletion} onRefreshFeedPosts={onRefreshFeedPosts} vehicleOptions={vehicleOptions} />}
            {!completion && activeTab === "account" && <AccountScreen garageCount={garageList.length} member={member} onLogout={onLogout} onUpdateMember={onUpdateMember} />}
          </div>
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

function Dashboard({ appointments, benefitSummary, feedPosts, garage, member, onUpdateAppointment, setActiveTab }) {
  const [nowMs, setNowMs] = useState(Date.now());
  const [showAllAppointments, setShowAllAppointments] = useState(false);
  const [requestListOpen, setRequestListOpen] = useState(false);
  const [requestFilter, setRequestFilter] = useState("all");
  const serviceReminders = buildServiceReminders(garage, member.plan);
  const upcomingBookings = upcomingAppointmentCountdowns(appointments, nowMs);
  const garageInsights = garageInsightItems(garage);
  const smartCards = homeSmartCards({ garage, insights: garageInsights, reminders: serviceReminders });
  const events = feedEventPosts(feedPosts);
  const [servicesExpanded, setServicesExpanded] = useState(false);
  const visibleServices = servicesExpanded ? services : services.slice(0, 3);
  const filteredRequests = ensureList(appointments).filter((appointment) => {
    const status = normalizeRequestValue(appointment.status);
    if (requestFilter === "completed") return status === "completed";
    if (requestFilter === "booked") return ["approved", "booked", "paid / confirmed"].includes(status);
    if (requestFilter === "requested") return ["requested", "in review"].includes(status);
    return true;
  });
  const visibleRequests = requestListOpen ? filteredRequests : filteredRequests.slice(0, 3);

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="app-stack">
      <section className="app-section home-priority">
        <div className="app-section-title">
          <div>
            <p className="eyebrow">Next appointment</p>
            <h2>Appointment Countdown</h2>
            <p>Your nearest scheduled appointment is always shown first.</p>
          </div>
          <button type="button" onClick={() => setActiveTab("schedule")}>Schedule</button>
        </div>
        {upcomingBookings.length > 0 ? (
          <>
            <article className="next-appointment-clock">
              <div className="next-clock-face" aria-label={`Countdown to ${upcomingBookings[0].service}`}>
                <CalendarCheck size={30} />
                <strong>{upcomingBookings[0].countdown.primary}</strong>
                <span>{upcomingBookings[0].countdown.secondary}</span>
              </div>
              <div>
                <span>{upcomingBookings[0].status || "Requested"}</span>
                <h3>{upcomingBookings[0].service}</h3>
                <p>{upcomingBookings[0].vehicle}</p>
                <small>{upcomingBookings[0].date} at {upcomingBookings[0].time || "Time pending"}</small>
              </div>
            </article>
            {upcomingBookings.length > 1 && (
              <button className="countdown-more-button" type="button" onClick={() => setShowAllAppointments((open) => !open)}>
                {showAllAppointments ? "Show less" : `More appointments (${upcomingBookings.length - 1})`}
              </button>
            )}
            {showAllAppointments && (
              <div className="appointment-countdown-list">
                {upcomingBookings.slice(1).map((appointment) => {
              const ServiceIcon = serviceIconForRequest(appointment.service);
              return (
                <article className="appointment-countdown-card" key={appointment.id}>
                  <div className="service-clock-countdown" aria-label={`Countdown to ${appointment.service}`}>
                    <Clock size={18} />
                    <strong>{appointment.countdown.primary}</strong>
                    <span>{appointment.countdown.secondary}</span>
                  </div>
                  <div className="countdown-copy">
                    <span><ServiceIcon size={16} /> {appointment.status || "Requested"}</span>
                    <h3>{appointment.service}</h3>
                    <p>{appointment.vehicle} · {appointment.date} {appointment.time || ""}</p>
                  </div>
                </article>
              );
                })}
              </div>
            )}
          </>
        ) : (
          <div className="empty-state compact-empty">
            <CalendarCheck size={24} />
            <h3>No scheduled appointment yet</h3>
            <p>Book a service with a preferred date and time to start a live countdown.</p>
            <button type="button" onClick={() => setActiveTab("schedule")}>Book a service</button>
          </div>
        )}
      </section>

      <section className="home-smart-grid" aria-label="Smart garage overview">
        {smartCards.map(({ cta, href, icon: Icon, label, text, title }) => (
          <article key={label}>
            <Icon size={19} />
            <span>{label}</span>
            <h3>{title}</h3>
            <p>{text}</p>
            {href ? (
              <a href={href} target="_blank" rel="noreferrer">{cta}</a>
            ) : (
              <button type="button" onClick={() => setActiveTab("feed")}>{cta}</button>
            )}
          </article>
        ))}
      </section>

      <section className="app-section home-events-section">
        <div className="app-section-title">
          <div>
            <p className="eyebrow">Member community</p>
            <h2>Events</h2>
            <p>Upcoming drives, meets, track days, and member gatherings.</p>
          </div>
          <button type="button" onClick={() => setActiveTab("feed")}>{events.length ? "See all" : "Add event"}</button>
        </div>
        {events.length ? (
          <div className="feed-grid home-events-grid">
            {events.slice(0, 3).map((post) => <FeedPostCard key={post.id} post={post} />)}
          </div>
        ) : (
          <div className="empty-state compact-empty">
            <CalendarCheck size={24} />
            <h3>No events posted yet</h3>
            <p>Open the Feed to create the first White Glove member event.</p>
          </div>
        )}
      </section>

      <section className="app-section member-benefits-section">
        <div className="app-section-title">
          <div>
            <p className="eyebrow">{member.plan} membership</p>
            <h2>Your Included Benefits</h2>
            <p>Annual credits are counted here when White Glove applies them to a service request.</p>
          </div>
          <button type="button" onClick={() => setActiveTab("schedule")}>Use A Benefit</button>
        </div>
        <div className="member-benefit-grid">
          {benefitSummary.map((benefit) => {
            const percentage = benefit.annualQuantity ? Math.round((benefit.remaining / benefit.annualQuantity) * 100) : 0;
            return (
              <article className={benefit.remaining > 0 ? "" : "benefit-exhausted"} key={benefit.key}>
                <div className="member-benefit-icon"><Gift size={20} /></div>
                <div className="member-benefit-heading">
                  <span>{benefit.label}</span>
                  <strong>{benefit.remaining} of {benefit.annualQuantity} left</strong>
                </div>
                <div className="member-benefit-progress" aria-label={`${benefit.remaining} of ${benefit.annualQuantity} ${benefit.label} benefits remaining`}>
                  <span style={{ width: `${percentage}%` }} />
                </div>
                <p>{formatCad(benefit.creditCents / 100)} credit each</p>
                <small>{benefit.note}</small>
              </article>
            );
          })}
        </div>
        <p className="member-benefit-footnote">Credits reset each membership year, do not roll over, have no cash value, and cannot be stacked with another discount.</p>
      </section>

      <section className="app-section">
        <div className="app-section-title">
          <div>
            <h2>Services</h2>
            <p>Select a service category when you are ready to book.</p>
          </div>
          <button type="button" onClick={() => setServicesExpanded((expanded) => !expanded)}>
            {servicesExpanded ? "Show less" : "Show all"}
          </button>
        </div>
        <div className="service-category-grid compact-service-grid">
          {visibleServices.map(({ icon: Icon, title }) => (
            <button key={title} type="button" onClick={() => setActiveTab("schedule")}>
              <Icon size={20} />
              <span>{title}</span>
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
        <section className="app-section request-history-section">
          <div className="app-section-title">
            <div>
              <h2>Recent Requests</h2>
              <p>Open the complete list and sort it by service status.</p>
            </div>
            <button type="button" onClick={() => setRequestListOpen((open) => !open)}>{requestListOpen ? "Close list" : "More"}</button>
          </div>
          {requestListOpen && (
            <div className="request-filter-tabs" role="group" aria-label="Filter service requests">
              {[
                ["all", "All"],
                ["requested", "Requested"],
                ["booked", "Booked"],
                ["completed", "Completed services"],
              ].map(([value, label]) => (
                <button className={requestFilter === value ? "active" : ""} key={value} onClick={() => setRequestFilter(value)} type="button">{label}</button>
              ))}
            </div>
          )}
          {visibleRequests.length ? visibleRequests.map((appointment) => (
            <ServiceRequestCard appointment={appointment} key={appointment.id} onUpdateAppointment={onUpdateAppointment} />
          )) : (
            <div className="empty-state compact-empty">
              <ClipboardCheck size={22} />
              <h3>No {requestFilter === "all" ? "service" : requestFilter} requests</h3>
              <p>Requests with this status will appear here.</p>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function GarageScreen({ appointments, garage, member, onAddAppointment, onAddVehicle, onDeleteVehicle, onUpdateVehicle, onComplete }) {
  const garageList = ensureList(garage);
  const serviceReminders = useMemo(() => buildServiceReminders(garageList, member.plan), [garageList, member.plan]);
  const garageInsights = useMemo(() => garageInsightItems(garageList), [garageList]);
  const canAddVehicle = canAddGarageVehicle(member.plan, garageList.length);
  const vehicleLimitText = garageLimitLabel(member.plan);
  const [showForm, setShowForm] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [requestError, setRequestError] = useState("");
  const selectedVehicle = garageList.find((vehicle) => vehicle.id === selectedVehicleId);

  useEffect(() => {
    if (!canAddVehicle && showForm) {
      setShowForm(false);
    }
  }, [canAddVehicle, showForm]);

  async function sendReminderRequest(reminder) {
    setRequestError("");

    try {
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
    } catch (error) {
      setRequestError(error.message || "Could not send that service request.");
    }
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

      <section className="app-section garage-intelligence-section">
        <div className="app-section-title">
          <div>
            <h2>Recommended For Your Garage</h2>
            <p>Maintenance, upgrades, and common watch items based on the vehicles you uploaded.</p>
          </div>
          <span>{garageInsights.length} recommendations</span>
        </div>
        {garageInsights.length ? (
          <div className="garage-insight-grid">
            {garageInsights.map(({ detail, icon: Icon, id, title, type }) => (
              <article key={id}>
                <Icon size={20} />
                <div>
                  <span>{type}</span>
                  <h3>{title}</h3>
                  <p>{detail}</p>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state compact-empty">
            <Gauge size={24} />
            <h3>Add vehicle details for recommendations</h3>
            <p>Make, model, mileage, service timing, battery age, and tire age improve garage recommendations.</p>
          </div>
        )}
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
            {requestError && <div className="error-message" role="alert">{requestError}</div>}
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

function ScheduleScreen({ appointments, benefitSummary, garage, member, onAddAppointment, onComplete, onUpdateAppointment, servicePricing, setActiveTab, vehicleOptions }) {
  const includedServices = useMemo(() => getAvailableServices(member.plan), [member.plan]);
  const serviceReminders = useMemo(() => buildServiceReminders(garage, member.plan), [garage, member.plan]);
  const [selectedService, setSelectedService] = useState(includedServices[0]?.label || "");
  const [selectedServiceOption, setSelectedServiceOption] = useState(serviceOptionsForBooking(includedServices[0]?.label)[0] || "Not Sure");
  const [selectedVehicleId, setSelectedVehicleId] = useState(garage[0]?.id || "");
  const [reminderError, setReminderError] = useState("");
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
    setReminderError("");

    try {
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
    } catch (error) {
      setReminderError(error.message || "Could not send that service request.");
    }
  }

  return (
    <div className="app-stack">
      <section className="app-section booking-benefit-balance">
        <div className="app-section-title">
          <div>
            <p className="eyebrow">Included with {member.plan}</p>
            <h2>Benefits Available To Use</h2>
            <p>Tell the concierge you want to use an eligible credit. Your balance updates when it is applied to the request.</p>
          </div>
        </div>
        <div>
          {benefitSummary.map((benefit) => (
            <article className={benefit.remaining > 0 ? "" : "benefit-exhausted"} key={benefit.key}>
              <Gift size={18} />
              <span>{benefit.shortLabel}</span>
              <strong>{benefit.remaining}/{benefit.annualQuantity} left</strong>
            </article>
          ))}
        </div>
      </section>

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
            {reminderError && <div className="error-message" role="alert">{reminderError}</div>}
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
          appointments={appointments}
          garage={garage}
          member={member}
          onAddAppointment={onAddAppointment}
          onComplete={onComplete}
          onChangeVehicle={() => vehicleSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
          servicePricing={servicePricing}
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
          <ServiceRequestCard appointment={appointment} key={appointment.id} onUpdateAppointment={onUpdateAppointment} />
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
            <img alt={label} onError={handleVehicleImageError} src={primaryVehicleImage(vehicle)} />
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
  const [showComposer, setShowComposer] = useState(false);
  const eventPosts = feedEventPosts(feedPosts);
  const photoPosts = feedPosts.filter((post) => !parseFeedEvent(post));

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
            <p>Browse member photos and events from the White Glove community.</p>
          </div>
          <div className="feed-header-actions">
            <button type="button" onClick={refreshFeed} disabled={refreshingFeed}>
              {refreshingFeed ? "Refreshing" : `${feedPosts.length} posts`}
            </button>
            <button
              aria-label={showComposer ? "Close feed upload" : "Add to feed"}
              className="icon-button feed-add-button"
              type="button"
              onClick={() => setShowComposer((open) => !open)}
            >
              {showComposer ? <X size={20} /> : <Plus size={20} />}
            </button>
          </div>
        </div>
        {feedNotice && (
          <div className="error-message" role="alert">
            {feedNotice}
          </div>
        )}
        {showComposer && (
          <FeedUploadForm
            onAddFeedPost={onAddFeedPost}
            onComplete={onComplete}
            onPosted={() => setShowComposer(false)}
            vehicleOptions={vehicleOptions}
          />
        )}
        {feedPosts.length === 0 ? (
          <div className="empty-state">
            <Upload size={26} />
            <h3>No feed posts yet</h3>
            <p>Tap the plus button to add the first photo or event.</p>
          </div>
        ) : (
          <div className="feed-sections">
            <FeedContentSection
              emptyText="No events have been posted yet."
              posts={eventPosts}
              title="Events"
            />
            <FeedContentSection
              emptyText="No photos have been posted yet."
              posts={photoPosts}
              title="Photos"
            />
          </div>
        )}
      </section>
    </div>
  );
}

function FeedContentSection({ emptyText, posts, title }) {
  return (
    <section className="feed-content-section" aria-label={title}>
      <div className="feed-content-heading">
        <h3>{title}</h3>
        <span>{posts.length}</span>
      </div>
      {posts.length === 0 ? (
        <div className="feed-empty-row">{emptyText}</div>
      ) : (
        <div className="feed-grid">
          {posts.map((post) => (
            <FeedPostCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </section>
  );
}

function FeedUploadForm({ onAddFeedPost, onComplete, onPosted, vehicleOptions }) {
  const [postType, setPostType] = useState("vehicle");
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

    if (postType === "vehicle" && !imagePreview) {
      setFeedError("Upload a photo before posting to the feed.");
      return;
    }

    const form = event.currentTarget;
    const formData = new FormData(form);

    const eventTitle = formData.get("eventTitle");
    const eventTime = formData.get("eventTime");
    const eventPlace = formData.get("eventPlace");
    const eventDescription = formData.get("eventDescription");
    const caption = postType === "event"
      ? encodeFeedEvent({ description: eventDescription, place: eventPlace, time: eventTime, title: eventTitle })
      : formData.get("caption");

    try {
      const savedPost = await onAddFeedPost({
        caption,
        image: postType === "event" ? eventFallbackImage : imagePreview,
        vehicle: formData.get("vehicle"),
      });

      form.reset();
      setImagePreview("");
      onPosted?.();
      onComplete?.({
        actionLabel: "View Feed",
        actionTab: "feed",
        details: [
          ["Type", postType === "event" ? "Event" : "Vehicle post"],
          ["Vehicle", savedPost.vehicle || (postType === "event" ? "Member event" : "Garage update")],
          ["Post", postType === "event" ? eventTitle || "Event posted" : savedPost.caption || "Photo uploaded"],
          ["Status", "Posted"],
        ],
        message: postType === "event" ? "Your event has been added to the member feed." : "Your photo has been added to the member feed.",
        secondaryLabel: "Back Home",
        secondaryTab: "home",
        title: postType === "event" ? "Event successfully posted." : "Feed post successfully updated.",
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
      <div className="feed-type-toggle">
        <button className={postType === "vehicle" ? "active" : ""} type="button" onClick={() => setPostType("vehicle")}>
          Vehicle post
        </button>
        <button className={postType === "event" ? "active" : ""} type="button" onClick={() => setPostType("event")}>
          Add event
        </button>
      </div>
      {postType === "vehicle" && (
        <label className="upload-tile feed-upload-tile">
          {imagePreview ? <img alt="Feed preview" src={imagePreview} /> : <><Upload size={24} /><span>Upload feed photo</span></>}
          <input accept="image/*" name="photo" onChange={handleImage} type="file" />
        </label>
      )}
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
        {postType === "vehicle" ? (
          <label>
            Caption
            <input name="caption" type="text" placeholder="Fresh detail, delivery day, service update..." />
          </label>
        ) : (
          <>
            <label>
              Event title
              <input name="eventTitle" required type="text" placeholder="Cars and coffee, rally, track day..." />
            </label>
            <label>
              Time
              <input name="eventTime" required type="datetime-local" />
            </label>
            <label>
              Place
              <input name="eventPlace" required type="text" placeholder="Venue, city, or meeting point" />
            </label>
            <label>
              Description
              <input name="eventDescription" required type="text" placeholder="What members should know before attending" />
            </label>
          </>
        )}
      </div>
      <button className="button primary submit" type="submit">{postType === "event" ? "Post Event" : "Post To Feed"}</button>
    </form>
  );
}

function FeedPostCard({ post }) {
  const event = parseFeedEvent(post);

  if (event) {
    return (
      <article className="feed-event-card">
        <div className="feed-event-icon">
          <CalendarCheck size={24} />
        </div>
        <div>
          <span>{event.time || "Event"}</span>
          <h3>{event.title}</h3>
          <p>{event.place}</p>
          <small>{event.description}</small>
          <p>{post.author || "Member"} · {formatPostDate(post.createdAt)}</p>
        </div>
      </article>
    );
  }

  return (
    <article>
      <img alt={post.caption || "Vehicle feed post"} src={post.image || eventFallbackImage} />
      <div>
        <span>{post.vehicle || "Garage update"}</span>
        <h3>{post.caption || "White Glove member post"}</h3>
        <p>{post.author || "Member"} · {formatPostDate(post.createdAt)}</p>
      </div>
    </article>
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
    setSettingsError("");
    setSettingsNotice("");
    if (!file.type?.startsWith("image/")) {
      setSettingsError("Choose an image file for your profile picture.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setSettingsError("Profile pictures must be smaller than 10 MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => setAvatarPreview(reader.result);
    reader.onerror = () => setSettingsError("Could not preview that profile picture.");
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
      const savedMember = await onUpdateMember({
        avatarUrl: avatarPreview,
        name: formData.get("name"),
        username: formData.get("username"),
        notifications: nextNotifications,
        password: formData.get("password"),
      });
      setAvatarPreview(savedMember?.avatarUrl || avatarPreview);
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
              <input type="text" value={`${member.plan || "Club Drive"} · managed through your subscription`} readOnly />
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
  const [imagePreviews, setImagePreviews] = useState([]);
  const [makeSuggestions, setMakeSuggestions] = useState(fallbackVehicleMakes);
  const [modelSuggestions, setModelSuggestions] = useState([]);
  const [vehicleMake, setVehicleMake] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [vehicleYear, setVehicleYear] = useState("");
  const [vehicleLookupStatus, setVehicleLookupStatus] = useState("");
  const [savingVehicle, setSavingVehicle] = useState(false);
  const [vehicleError, setVehicleError] = useState("");

  useEffect(() => {
    let active = true;

    fetchVehicleMakes()
      .then((makes) => {
        if (active && makes.length) setMakeSuggestions(makes);
      })
      .catch(() => {
        if (active) setMakeSuggestions(fallbackVehicleMakes);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const fallbackModels = fallbackModelsForMake(vehicleMake);

    if (!vehicleMake.trim()) {
      setModelSuggestions([]);
      setVehicleLookupStatus("");
      return () => {
        active = false;
      };
    }

    setVehicleLookupStatus("Loading models...");
    fetchVehicleModels({ make: vehicleMake, year: vehicleYear })
      .then((models) => {
        if (!active) return;
        const nextModels = models.length ? models : fallbackModels;
        setModelSuggestions(nextModels);
        setVehicleLookupStatus(nextModels.length ? `${nextModels.length} model suggestions loaded` : "Type the model if it does not appear.");
      })
      .catch(() => {
        if (!active) return;
        setModelSuggestions(fallbackModels);
        setVehicleLookupStatus(fallbackModels.length ? "Using offline model suggestions." : "Type the model if it does not appear.");
      });

    return () => {
      active = false;
    };
  }, [vehicleMake, vehicleYear]);

  async function handleImage(event) {
    try {
      const photos = await readFilesAsDataUrls(event.target.files, 10);
      setImagePreviews(photos);
    } catch (error) {
      setVehicleError(error.message || "Could not read those photos.");
    }
  }

  async function submitVehicle(event) {
    event.preventDefault();
    if (savingVehicle) return;

    setVehicleError("");
    setSavingVehicle(true);
    const form = event.currentTarget;
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
        image: imagePreviews[0] || "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=900&q=85",
        images: imagePreviews.length ? imagePreviews : [],
      });
      form.reset();
      setVehicleMake("");
      setVehicleModel("");
      setVehicleYear("");
      setModelSuggestions([]);
      setVehicleLookupStatus("");
      setImagePreviews([]);
      setSavingVehicle(false);
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
      setSavingVehicle(false);
    }
  }

  return (
    <form className="app-form inline-form" onSubmit={submitVehicle}>
      {vehicleError && (
        <div className="error-message" role="alert">
          {vehicleError}
        </div>
      )}
      <label className={savingVehicle ? "upload-tile disabled-upload" : "upload-tile"}>
        {imagePreviews.length ? (
          <div className="upload-preview-grid">
            {imagePreviews.map((image, index) => (
              <img alt={`Vehicle preview ${index + 1}`} key={`${image}-${index}`} src={image} />
            ))}
          </div>
        ) : (
          <>
            <Upload size={24} />
            <span>Upload up to 10 vehicle photos</span>
          </>
        )}
        <input accept="image/*" disabled={savingVehicle} multiple name="photo" onChange={handleImage} type="file" />
      </label>
      <div className="app-form-grid">
        <label>
          Year
          <input name="year" onChange={(event) => setVehicleYear(event.target.value)} required type="number" placeholder="2024" value={vehicleYear} />
        </label>
        <label>
          Make
          <input autoComplete="off" list="vehicle-make-options" name="make" onChange={(event) => setVehicleMake(event.target.value)} required type="text" placeholder="Start typing the make" value={vehicleMake} />
          <datalist id="vehicle-make-options">
            {makeSuggestions.map((make) => (
              <option key={make} value={make} />
            ))}
          </datalist>
        </label>
        <label>
          Model
          <input autoComplete="off" list="vehicle-model-options" name="model" onChange={(event) => setVehicleModel(event.target.value)} required type="text" placeholder="Choose or type the model" value={vehicleModel} />
          <datalist id="vehicle-model-options">
            {modelSuggestions.map((model) => (
              <option key={model} value={model} />
            ))}
          </datalist>
          {vehicleLookupStatus && <small className="field-hint">{vehicleLookupStatus}</small>}
        </label>
        <label>
          Mileage
          <input name="mileage" type="text" placeholder="Current mileage" />
        </label>
        <label>
          VIN
          <input name="vin" type="text" placeholder="Vehicle identification number" />
        </label>
        <label>
          License plate
          <input name="plate" type="text" placeholder="License plate" />
        </label>
        <label>
          Color
          <input name="color" type="text" placeholder="Vehicle color" />
        </label>
        <label>
          Vehicle location
          <input name="location" type="text" placeholder="Current city or address" />
        </label>
        <label>
          Current market value
          <input name="marketValue" type="text" placeholder="Estimated value" />
        </label>
        <label>
          Horsepower
          <input name="horsepower" type="text" placeholder="Horsepower if known" />
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
          <input name="pickupLocation" type="text" placeholder="Preferred pickup address or location" />
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
          <input name="nextService" type="date" />
        </label>
        <label>
          Last oil change
          <input name="lastOilChange" type="date" />
        </label>
        <label>
          Service interval
          <input name="serviceInterval" type="text" placeholder="Every 6 months or 8,000 km" />
        </label>
        <label>
          Last detail
          <input name="lastDetail" type="date" />
        </label>
        <label>
          Last brake service
          <input name="brakeService" type="date" />
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
          Tire install date
          <input name="tireAge" type="date" />
        </label>
        <label>
          Last battery change
          <input name="batteryAge" type="date" />
        </label>
        <label>
          Registration renewal
          <input name="registration" type="date" />
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
      <button className="button primary submit" type="submit" disabled={savingVehicle}>
        {savingVehicle ? "Saving Vehicle..." : "Save Vehicle"}
      </button>
    </form>
  );
}

function ScheduleForm({ appointments, garage, member, onAddAppointment, onChangeVehicle, onComplete, servicePricing, selectedService, selectedServiceOption, selectedVehicle, setSelectedService, setSelectedServiceOption }) {
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
  const serviceDetailFields = serviceDetailFieldsForBooking(selectedService);
  const needsSavedVehicle = serviceRequiresSavedVehicle(selectedService);
  const hasVehicles = !needsSavedVehicle || (garage.length > 0 && Boolean(selectedVehicle));
  const basePaymentTerms = paymentTermsForService(selectedService, selectedVehicle, selectedServiceOption, servicePricing);
  const selectedTransportChoice = transportChoices.find((choice) => choice.value === transportChoice) || transportChoices[0];
  const selectedPaymentTerms = bookingPaymentTerms(basePaymentTerms, selectedTransportChoice, warrantyCoverage);
  const selectedVehicleClass = vehicleClassFromVehicle(selectedVehicle);
  const showVehicleLogistics = needsSavedVehicle;

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
    const serviceDetailNotes = serviceDetailFields
      .map((field) => [field.label, formData.get(field.name)])
      .filter(([, value]) => value)
      .map(([label, value]) => `${label}: ${value}`);
    const appointment = {
      vehicle: selectedVehicle ? vehicleLabel(selectedVehicle) : needsSavedVehicle ? "" : "No saved vehicle needed",
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
        ...serviceDetailNotes,
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

      if (hasOpenMatchingServiceRequest(appointments, appointment)) {
        throw new Error(`You already have an open ${appointment.service} request for ${appointment.vehicle}. Wait until it is approved before booking that same service again.`);
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
          ...Object.fromEntries(serviceDetailFields.map((field) => [field.name, formData.get(field.name) || ""])),
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
        const response = await fetch(netlifyFunctionUrl("/.netlify/functions/create-checkout-session"), {
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
          <img alt={vehicleLabel(selectedVehicle)} onError={handleVehicleImageError} src={primaryVehicleImage(selectedVehicle)} />
          <div>
            <span>Your vehicle</span>
            <h3>{vehicleLabel(selectedVehicle)}</h3>
            <p>{vehicleMeta(selectedVehicle)} • {selectedVehicleClass.toUpperCase()}</p>
          </div>
          <button type="button" onClick={onChangeVehicle}>Change vehicle</button>
        </div>
      )}
      {!needsSavedVehicle && !selectedVehicle && (
        <div className="selected-vehicle-summary service-only-summary">
          <CalendarCheck size={24} />
          <div>
            <span>{selectedService}</span>
            <h3>No garage vehicle required</h3>
            <p>White Glove will use the request details below to coordinate this service.</p>
          </div>
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
      {serviceDetailFields.length > 0 && (
        <div className="service-extra-fields">
          <span className="eyebrow">Service details</span>
          <div className="app-form-grid">
            {serviceDetailFields.map((field) => (
              <label key={field.name}>
                {field.label}
                <input name={field.name} required type={field.type || "text"} placeholder={field.placeholder || ""} />
              </label>
            ))}
          </div>
        </div>
      )}
      {showVehicleLogistics && (
        <>
          <AddressAutocomplete
            label="Car's current location"
            name="currentLocation"
            onChange={setCurrentLocation}
            placeholder="Start typing a saved address, storage location, dealership, or shop"
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
        </>
      )}
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
  const vehicleImages = vehicleImageGallery(vehicle);

  return (
    <button className="vehicle-card" type="button" onClick={onSelect} disabled={!vehicle.id}>
      <div className="vehicle-card-photo">
        <img alt={label} onError={handleVehicleImageError} src={vehicleImages[0] || fallbackVehicleImage} />
        {vehicleImages.length > 1 && <small>{vehicleImages.length} photos</small>}
      </div>
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
  const [photoPreviews, setPhotoPreviews] = useState([]);
  const [detailError, setDetailError] = useState("");
  const [deletingVehicle, setDeletingVehicle] = useState(false);
  const [offerRequested, setOfferRequested] = useState(false);
  const vehicleImages = vehicleImageGallery(vehicle);
  const heroImage = photoPreviews[0] || vehicleImages[0] || vehicle.image || fallbackVehicleImage;
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

  async function handlePhoto(event) {
    try {
      const photos = await readFilesAsDataUrls(event.target.files, 10);
      setPhotoPreviews(photos);
    } catch (error) {
      setDetailError(error.message || "Could not read those photos.");
    }
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
        image: photoPreviews[0] || vehicleImages[0] || vehicle.image,
        images: photoPreviews.length ? photoPreviews : vehicleImages,
      });
      setPhotoPreviews([]);
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
        <img alt={vehicleLabel} onError={handleImageError} src={heroImage} />
        <div>
          <span>{vehicle.use || "Collection"}</span>
          <h2>{vehicleLabel}</h2>
          <p>{vehicle.status || "Active"} · {marketValue}</p>
        </div>
      </section>

      {vehicleImages.length > 1 && (
        <section className="vehicle-gallery-strip" aria-label={`${vehicleLabel} photo gallery`}>
          {vehicleImages.map((image, index) => (
            <img alt={`${vehicleLabel} photo ${index + 1}`} key={`${image}-${index}`} onError={handleImageError} src={image} />
          ))}
        </section>
      )}

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
            {photoPreviews.length ? (
              <div className="upload-preview-grid">
                {photoPreviews.map((image, index) => (
                  <img alt={`Updated vehicle preview ${index + 1}`} key={`${image}-${index}`} src={image} />
                ))}
              </div>
            ) : (
              <>
                <Upload size={24} />
                <span>Upload up to 10 vehicle photos</span>
              </>
            )}
            <input accept="image/*" multiple name="photo" onChange={handlePhoto} type="file" />
          </label>
          <div className="app-form-grid">
            <label>
              Current market value
              <input defaultValue={vehicle.marketValue || ""} name="marketValue" placeholder="Estimated value" type="text" />
            </label>
            <label>
              Horsepower
              <input defaultValue={vehicle.horsepower || ""} name="horsepower" placeholder="Horsepower if known" type="text" />
            </label>
            <label>
              Mileage
              <input defaultValue={vehicle.mileage || ""} name="mileage" placeholder="Current mileage" type="text" />
            </label>
            <label>
              Status
              <input defaultValue={vehicle.status || ""} name="status" placeholder="Detail due" type="text" />
            </label>
            <label>
              VIN
              <input defaultValue={vehicle.vin || ""} name="vin" placeholder="Vehicle identification number" type="text" />
            </label>
            <label>
              License plate
              <input defaultValue={vehicle.plate || ""} name="plate" placeholder="License plate" type="text" />
            </label>
            <label>
              Color
              <input defaultValue={vehicle.color || ""} name="color" placeholder="Vehicle color" type="text" />
            </label>
            <label>
              Condition
              <input defaultValue={vehicle.condition || ""} name="condition" placeholder="Excellent, good, needs attention" type="text" />
            </label>
            <label>
              Location
              <input defaultValue={vehicle.location || ""} name="location" placeholder="Current city or address" type="text" />
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
              <input defaultValue={vehicle.pickupLocation || ""} name="pickupLocation" placeholder="Preferred pickup address or location" type="text" />
            </label>
            <label>
              Next service
              <input defaultValue={dateInputValue(vehicle.nextService)} name="nextService" type="date" />
            </label>
            <label>
              Last oil change
              <input defaultValue={dateInputValue(vehicle.lastOilChange)} name="lastOilChange" type="date" />
            </label>
            <label>
              Service interval
              <input defaultValue={vehicle.serviceInterval || ""} name="serviceInterval" placeholder="Every 6 months or 8,000 km" type="text" />
            </label>
            <label>
              Last detail
              <input defaultValue={dateInputValue(vehicle.lastDetail)} name="lastDetail" type="date" />
            </label>
            <label>
              Last brake service
              <input defaultValue={dateInputValue(vehicle.brakeService)} name="brakeService" type="date" />
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
              Tire install date
              <input defaultValue={dateInputValue(vehicle.tireAge)} name="tireAge" type="date" />
            </label>
            <label>
              Last battery change
              <input defaultValue={dateInputValue(vehicle.batteryAge)} name="batteryAge" type="date" />
            </label>
            <label>
              Registration renewal
              <input defaultValue={dateInputValue(vehicle.registration)} name="registration" type="date" />
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

function ServiceRequestCard({ appointment, onUpdateAppointment }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [nowMs, setNowMs] = useState(Date.now());
  const paymentSummary = appointment.paymentTitle || appointment.notes?.match(/Payment:\s*([^-.\n]+)/i)?.[1]?.trim();
  const canEdit = Boolean(onUpdateAppointment) && isFutureServiceDate(appointment.date);
  const ServiceIcon = serviceIconForRequest(appointment.service);
  const target = appointmentDateTime(appointment);
  const activeStatus = !["completed", "cancelled", "canceled"].includes(normalizeRequestValue(appointment.status));
  const countdown = activeStatus && target && target.getTime() > nowMs ? countdownLabel(target, nowMs) : null;

  useEffect(() => {
    if (!target || !activeStatus || target.getTime() <= Date.now()) return undefined;
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [activeStatus, appointment.date, appointment.time]);

  async function saveRequestEdits(event) {
    event.preventDefault();
    if (!canEdit || saving) return;

    setEditError("");
    setSaving(true);
    const formData = new FormData(event.currentTarget);

    try {
      await onUpdateAppointment(appointment.id, {
        date: formData.get("date"),
        time: formData.get("time"),
        notes: formData.get("notes"),
      });
      setEditing(false);
    } catch (error) {
      setEditError(error.message || "Could not update this service request.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className="request-card">
      <div className="request-icon">
        <ServiceIcon size={22} />
      </div>
      <div>
        <span>{appointment.status}</span>
        <h3>{appointment.service}</h3>
        <p>{appointment.vehicle}</p>
        {paymentSummary && <small>{paymentSummary}</small>}
      </div>
      <div className="request-date">
        <strong>{appointment.date || "Date pending"}</strong>
        <span>{appointment.time || "Time pending"}</span>
        {countdown && <span className="request-live-countdown"><Clock size={14} /> {countdown.primary} {countdown.secondary}</span>}
        {canEdit ? (
          <button type="button" onClick={() => setEditing((open) => !open)}>
            {editing ? "Close" : "Edit"}
          </button>
        ) : (
          <small>Locked today</small>
        )}
      </div>
      {editing && (
        <form className="request-edit-form" onSubmit={saveRequestEdits}>
          {editError && <div className="error-message" role="alert">{editError}</div>}
          <div className="app-form-grid">
            <label>
              Preferred date
              <input defaultValue={dateInputValue(appointment.date)} min={new Date(Date.now() + 86400000).toISOString().slice(0, 10)} name="date" required type="date" />
            </label>
            <label>
              Preferred time
              <input defaultValue={appointment.time || ""} name="time" required type="time" />
            </label>
          </div>
          <label>
            Notes
            <textarea defaultValue={appointment.notes || ""} name="notes" rows="3" placeholder="Add updated notes for the concierge." />
          </label>
          <div className="request-card-actions">
            <button className="button secondary" type="button" onClick={() => setEditing(false)} disabled={saving}>
              Cancel
            </button>
            <button className="button primary" type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      )}
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
