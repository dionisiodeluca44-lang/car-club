import React, { Component, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Bell,
  CalendarCheck,
  Car,
  Check,
  ChevronRight,
  ClipboardCheck,
  Clock,
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
  getCurrentMember,
  isBackendConfigured,
  loadFeedPosts,
  loadServiceRequests,
  loadVehicles,
  resendConfirmationEmail,
  signIn,
  signOut,
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
    features: ["Everything in Gold", "Monthly vehicle care", "Full maintenance concierge", "Emergency coordination", "Multi-car support"],
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

function getAvailableServices(plan) {
  return serviceOptions.filter((service) => service.allowedPlans.includes(plan));
}

function canBookService(plan, serviceLabel) {
  return getAvailableServices(plan).some((service) => service.label === serviceLabel);
}

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
    "Brake inspection": vehicle.status || "Inspection pending",
    "Battery age": vehicle.batteryAge || "Battery age pending",
    "Warranty work": vehicle.warranty || "Warranty pending",
    "Recalls": "Check with preferred dealer",
    "Annual inspection": "Inspection schedule pending",
    "Registration renewal": vehicle.registration || "Registration pending",
    Insurance: vehicle.insurance || "Insurance pending",
    "Storage check": vehicle.use === "Collection" || vehicle.use === "Seasonal" ? "Monthly check recommended" : "Not currently required",
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

function vehicleLabel(vehicle) {
  return `${vehicle.year || ""} ${vehicle.make || ""} ${vehicle.model || ""}`.trim() || "Garage vehicle";
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

  async function addVehicle(vehicle) {
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
      setFeedPosts((currentPosts) => [savedPost, ...currentPosts]);
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
    return <MemberApp appointments={appointments} feedPosts={feedPosts} garage={garage} member={member} onAddAppointment={addAppointment} onAddFeedPost={addFeedPost} onAddVehicle={addVehicle} onLogout={handleLogout} onUpdateVehicle={updateVehicle} />;
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
          <button className="nav-button" type="button" onClick={() => setMode(member ? "app" : "login")}>Member App</button>
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

function MemberApp({ appointments, feedPosts, garage, member, onAddAppointment, onAddFeedPost, onAddVehicle, onLogout, onUpdateVehicle }) {
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
          <button className="icon-button" type="button" aria-label="Notifications">
            <Bell size={20} />
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
              onAddFeedPost={onAddFeedPost}
              onAddVehicle={onAddVehicle}
              setActiveTab={setActiveTab}
              onComplete={setCompletion}
              feedPosts={feedPosts}
            />
          )}
          {!completion && activeTab === "garage" && <GarageScreen appointments={appointmentList} garage={garageList} member={member} onAddAppointment={onAddAppointment} onAddVehicle={onAddVehicle} onUpdateVehicle={onUpdateVehicle} onComplete={setCompletion} />}
          {!completion && activeTab === "schedule" && <ScheduleScreen appointments={appointmentList} garage={garageList} member={member} onAddAppointment={onAddAppointment} onComplete={setCompletion} vehicleOptions={vehicleOptions} />}
          {!completion && activeTab === "feed" && <FeedScreen feedPosts={feedPosts} member={member} onAddFeedPost={onAddFeedPost} vehicleOptions={vehicleOptions} />}
          {!completion && activeTab === "account" && <AccountScreen member={member} onLogout={onLogout} />}
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

function Dashboard({ appointments, feedPosts, garage, member, onAddAppointment, onAddFeedPost, onAddVehicle, onComplete, setActiveTab }) {
  const [showVehicleForm, setShowVehicleForm] = useState(false);
  const trackerCount = garage.reduce((total, vehicle) => total + vehicleTrackingItems(vehicle).length, 0);
  const needsInfoCount = garage.reduce(
    (total, vehicle) => total + vehicleTrackingItems(vehicle).filter((item) => item.status === "Needs info").length,
    0,
  );
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
      <section className="member-hero">
        <div>
          <span>{member.plan} member</span>
          <h2>{garage.length} vehicles under care</h2>
          <p>One app, one phone number, and one concierge team for every automotive need.</p>
        </div>
        <button className="button primary" type="button" onClick={() => setActiveTab("schedule")}>Need Something?</button>
      </section>

      <section className="app-metrics">
        <article>
          <Car size={22} />
          <strong>{garage.length}</strong>
          <span>Garage vehicles</span>
        </article>
        <article>
          <Clock size={22} />
          <strong>{appointments.length}</strong>
          <span>Service requests</span>
        </article>
        <article>
          <ShieldCheck size={22} />
          <strong>{trackerCount || "Ready"}</strong>
          <span>Tracked ownership items</span>
        </article>
      </section>

      <section className="app-section">
        <div className="app-section-title">
          <div>
            <h2>Ownership Tracker</h2>
            <p>We track the maintenance, documents, warranty, recalls, transport, storage, and emergency needs across your garage.</p>
          </div>
          <button type="button" onClick={() => setActiveTab("garage")}>Review garage</button>
        </div>
        <div className="tracker-summary-grid">
          <article>
            <strong>{garage.length}</strong>
            <span>Vehicles managed</span>
          </article>
          <article>
            <strong>{trackerCount}</strong>
            <span>Ownership items watched</span>
          </article>
          <article>
            <strong>{needsInfoCount}</strong>
            <span>Items needing details</span>
          </article>
        </div>
      </section>

      <section className="app-section">
        <div className="app-section-title">
          <div>
            <h2>Service Reminders</h2>
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
            <h2>Post To Feed</h2>
            <p>Upload garage photos, detail results, delivery shots, storage updates, and collection highlights.</p>
          </div>
          <button type="button" onClick={() => setActiveTab("feed")}>View Feed</button>
        </div>
        <FeedUploadForm onAddFeedPost={onAddFeedPost} onComplete={onComplete} vehicleOptions={garage.map(vehicleLabel)} />
        {feedPosts.length > 0 && (
          <div className="feed-preview-grid">
            {feedPosts.slice(0, 3).map((post) => (
              <article key={post.id}>
                <img alt={post.caption || "Feed post"} src={post.image} />
                <div>
                  <strong>{post.vehicle || "Garage update"}</strong>
                  <span>{post.caption || "White Glove member feed"}</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="app-section">
        <div className="app-section-title">
          <div>
            <h2>Need Something?</h2>
            <p>Tell your concierge what you need handled. We compare providers, coordinate transportation, and manage the request.</p>
          </div>
        </div>
        <div className="app-service-list">
          {conciergeActions.map(({ icon: Icon, label }) => (
            <article key={label}>
              <Icon size={22} />
              <div>
                <h3>{label}</h3>
                <p>Send this request to your concierge team.</p>
              </div>
              <button type="button" onClick={() => setActiveTab("schedule")} aria-label={`Request ${label}`}>
                <ChevronRight size={20} />
              </button>
            </article>
          ))}
        </div>
      </section>

      <section className="app-section">
        <div className="app-section-title">
          <h2>Next Requests</h2>
          <button type="button" onClick={() => setActiveTab("schedule")}>View all</button>
        </div>
        {appointments.slice(0, 3).map((appointment) => (
          <ServiceRequestCard appointment={appointment} key={appointment.id} />
        ))}
      </section>

      <section className="app-section">
        <div className="app-section-title">
          <h2>Garage Preview</h2>
          <button type="button" onClick={() => setShowVehicleForm((open) => !open)}>
            {showVehicleForm ? "Close" : "Add Vehicle"}
          </button>
        </div>
        {showVehicleForm && <VehicleForm onAddVehicle={onAddVehicle} onClose={() => setShowVehicleForm(false)} onComplete={onComplete} />}
        {garage.length === 0 ? (
          <div className="empty-state">
            <Car size={26} />
            <h3>No vehicles added yet</h3>
            <p>Add your first vehicle to unlock market value tracking, car details, work history, service requests, and offer requests.</p>
            <button className="button primary compact-button" type="button" onClick={() => setShowVehicleForm(true)}>
              <Plus size={18} /> Upload Your Car
            </button>
          </div>
        ) : (
          <div className="garage-list compact">
            {garage.slice(0, 2).map((vehicle) => (
              <VehicleCard key={vehicle.id} onSelect={() => setActiveTab("garage")} vehicle={vehicle} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function GarageScreen({ appointments, garage, member, onAddAppointment, onAddVehicle, onUpdateVehicle, onComplete }) {
  const garageList = ensureList(garage);
  const serviceReminders = useMemo(() => buildServiceReminders(garageList, member.plan), [garageList, member.plan]);
  const [showForm, setShowForm] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const selectedVehicle = garageList.find((vehicle) => vehicle.id === selectedVehicleId);

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

      <section className="app-section">
        <div className="app-section-title">
          <div>
            <h2>Your Garage</h2>
            <p>Upload your car collection with photos, mileage, notes, and usage type.</p>
          </div>
          <button className="button primary compact-button" type="button" onClick={() => setShowForm((open) => !open)}>
            <Plus size={18} /> Add Car
          </button>
        </div>
        {showForm && <VehicleForm onAddVehicle={onAddVehicle} onClose={() => setShowForm(false)} onComplete={onComplete} />}
        {!showForm && garageList.length === 0 && (
          <div className="empty-state">
            <Car size={26} />
            <h3>No vehicles in your garage yet</h3>
            <p>Add your first car to track market value, horsepower, photos, work history, and offer requests.</p>
            <button className="button primary compact-button" type="button" onClick={() => setShowForm(true)}>
              <Plus size={18} /> Add First Car
            </button>
          </div>
        )}
        <div className="garage-list">
          {garageList.map((vehicle, index) => (
            <VehicleCard key={vehicle.id || `${vehicle.make}-${vehicle.model}-${index}`} onSelect={() => setSelectedVehicleId(vehicle.id)} vehicle={vehicle} />
          ))}
        </div>
      </section>
    </div>
  );
}

function ScheduleScreen({ appointments, garage, member, onAddAppointment, onComplete, vehicleOptions }) {
  const includedServices = useMemo(() => getAvailableServices(member.plan), [member.plan]);
  const serviceReminders = useMemo(() => buildServiceReminders(garage, member.plan), [garage, member.plan]);
  const [selectedService, setSelectedService] = useState(includedServices[0]?.label || "");
  const formSectionRef = useRef(null);

  useEffect(() => {
    if (!includedServices.some((service) => service.label === selectedService)) {
      setSelectedService(includedServices[0]?.label || "");
    }
  }, [includedServices, selectedService]);

  function chooseService(serviceLabel) {
    if (!canBookService(member.plan, serviceLabel)) return;
    setSelectedService(serviceLabel);
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
      <section className="app-section">
        <div className="app-section-title">
          <div>
            <h2>Book A Service</h2>
            <p>Select a service, then fill out the appointment details below. Included services are ready to book; locked services show which package unlocks them.</p>
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
            <p>{selectedService ? `${selectedService} is selected. Add the vehicle, preferred timing, and notes.` : "Select an included service above to start booking."}</p>
          </div>
        </div>
        <ScheduleForm
          member={member}
          onAddAppointment={onAddAppointment}
          onComplete={onComplete}
          selectedService={selectedService}
          setSelectedService={setSelectedService}
          vehicleOptions={vehicleOptions}
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

function FeedScreen({ feedPosts, member, onAddFeedPost, vehicleOptions }) {
  return (
    <div className="app-stack">
      <section className="app-section">
        <div className="app-section-title">
          <div>
            <h2>Member Feed</h2>
            <p>Share vehicle photos, service updates, detail results, delivery moments, and collection highlights.</p>
          </div>
          <span>{feedPosts.length} posts</span>
        </div>
        <FeedUploadForm onAddFeedPost={onAddFeedPost} vehicleOptions={vehicleOptions} />
      </section>

      <section className="app-section">
        <div className="app-section-title">
          <div>
            <h2>Garage Feed</h2>
            <p>Photos uploaded by {member.name?.split(" ")[0] || "members"} appear here.</p>
          </div>
        </div>
        {feedPosts.length === 0 ? (
          <div className="empty-state">
            <Upload size={26} />
            <h3>No feed posts yet</h3>
            <p>Upload your first car photo from Home or this Feed screen.</p>
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

function AccountScreen({ member, onLogout }) {
  const includedServices = getAvailableServices(member.plan);

  return (
    <div className="app-stack">
      <section className="app-section account-panel">
        <div className="account-avatar">
          <User size={32} />
        </div>
        <h2>{member.name}</h2>
        <p>{member.email}</p>
        <span>{member.plan} membership</span>
        <button className="button secondary submit" type="button" onClick={onLogout}>
          <LogOut size={18} /> Log out
        </button>
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
        tireAge: formData.get("tireAge"),
        batteryAge: formData.get("batteryAge"),
        registration: formData.get("registration"),
        notes: ownershipNotes,
        marketValue: formData.get("marketValue") || "Value pending",
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
          ["Market value", savedVehicle?.marketValue || formData.get("marketValue") || "Value pending"],
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
          Next service
          <input name="nextService" type="text" placeholder="Oil change in 42 days" />
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

function ScheduleForm({ member, onAddAppointment, onComplete, selectedService, setSelectedService, vehicleOptions }) {
  const [requestSubmitted, setRequestSubmitted] = useState(false);
  const [requestError, setRequestError] = useState("");
  const availableServices = getAvailableServices(member.plan);
  const hasVehicles = vehicleOptions.length > 0;

  async function submitAppointment(event) {
    event.preventDefault();
    setRequestSubmitted(false);
    setRequestError("");

    const form = event.currentTarget;
    const formData = new FormData(event.currentTarget);
    const appointment = {
      vehicle: formData.get("vehicle"),
      service: formData.get("service"),
      date: formData.get("date"),
      time: formData.get("time"),
      notes: formData.get("notes"),
    };

    formData.set("form-name", "service-request");
    formData.set("memberName", member.name);
    formData.set("memberEmail", member.email);

    try {
      if (!hasVehicles) {
        throw new Error("Add a vehicle to your garage before requesting service.");
      }

      if (!canBookService(member.plan, appointment.service)) {
        throw new Error(`${appointment.service} is not included in your ${member.plan} package.`);
      }

      if (window.location.hostname !== "127.0.0.1" && window.location.hostname !== "localhost") {
        const response = await fetch("/", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams(formData).toString(),
        });

        if (!response.ok) {
          throw new Error("Service request failed");
        }
      }

      const savedRequest = await onAddAppointment(appointment);
      setRequestSubmitted(true);
      form.reset();
      onComplete?.({
        actionLabel: "View Requests",
        actionTab: "schedule",
        details: [
          ["Service", savedRequest?.service || appointment.service],
          ["Vehicle", savedRequest?.vehicle || appointment.vehicle],
          ["Preferred date", savedRequest?.date || appointment.date || "Date pending"],
        ],
        message: "Your concierge request has been sent. We will coordinate provider availability, pricing, transportation, and next steps.",
        secondaryLabel: "Back Home",
        secondaryTab: "home",
        title: "Service booking successfully updated.",
      });
    } catch (error) {
      setRequestError(error.message || "We could not send that request. Please try again or contact the concierge directly.");
    }
  }

  return (
    <form className="app-form inline-form" onSubmit={submitAppointment}>
      <input type="hidden" name="form-name" value="service-request" />
      <input type="hidden" name="memberName" value={member.name} />
      <input type="hidden" name="memberEmail" value={member.email} />
      <label className="hidden-field">
        Do not fill this out
        <input name="bot-field" tabIndex="-1" autoComplete="off" />
      </label>
      {requestSubmitted && (
        <div className="success-message" role="status">
          Service request sent. Your concierge team will follow up shortly.
        </div>
      )}
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
      <label>
        Vehicle
        <select name="vehicle" required disabled={!hasVehicles}>
          {!hasVehicles && <option>No vehicles added yet</option>}
          {vehicleOptions.map((vehicle) => (
            <option key={vehicle}>{vehicle}</option>
          ))}
        </select>
      </label>
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
          Preferred date
          <input name="date" required type="date" />
        </label>
        <label>
          Preferred time
          <input name="time" required type="time" />
        </label>
      </div>
      <label>
        Notes
        <textarea name="notes" rows="3" placeholder="Tell the concierge what you need handled." />
      </label>
      <button className="button primary submit" type="submit" disabled={!hasVehicles}>Request Service</button>
    </form>
  );
}

function VehicleCard({ onSelect, vehicle }) {
  const label = `${vehicle.year || ""} ${vehicle.make || ""} ${vehicle.model || ""}`.trim() || "Garage vehicle";
  const mileage = vehicle.mileage ? `${vehicle.mileage} miles` : "Mileage pending";
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
        <strong className="vehicle-value">{vehicle.marketValue || "Value pending"}</strong>
      </div>
      <strong>{vehicle.status || "Active"}</strong>
    </button>
  );
}

function VehicleDetailScreen({ appointments, onBack, onComplete, onGetOffer, onUpdateVehicle, vehicle }) {
  const [photoPreview, setPhotoPreview] = useState("");
  const [detailError, setDetailError] = useState("");
  const [offerRequested, setOfferRequested] = useState(false);
  const workHistory = ensureList(vehicle.workDone);
  const workDone = workHistory.length ? workHistory : ["No work logged yet"];
  const vehicleLabel = `${vehicle.year || ""} ${vehicle.make || ""} ${vehicle.model || ""}`.trim() || "Garage vehicle";
  const serviceHistory = serviceHistoryForVehicle(vehicle, appointments);
  const trackingItems = vehicleTrackingItems(vehicle);
  const ownershipProfile = [
    ["VIN", vehicle.vin || "Needed"],
    ["Location", vehicle.location || "Needed"],
    ["Insurance", vehicle.insurance || "Needed"],
    ["Warranty", vehicle.warranty || "Needed"],
    ["Preferred dealership", vehicle.preferredDealer || "Needed"],
    ["Preferred pickup", vehicle.pickupLocation || "Needed"],
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
      formData.get("location") && `Location: ${formData.get("location")}`,
      formData.get("insurance") && `Insurance: ${formData.get("insurance")}`,
      formData.get("warranty") && `Warranty: ${formData.get("warranty")}`,
      formData.get("preferredDealer") && `Preferred dealership: ${formData.get("preferredDealer")}`,
      formData.get("pickupLocation") && `Preferred pickup: ${formData.get("pickupLocation")}`,
      formData.get("nextService") && `Next service: ${formData.get("nextService")}`,
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
        location: formData.get("location") || vehicle.location,
        insurance: formData.get("insurance") || vehicle.insurance,
        warranty: formData.get("warranty") || vehicle.warranty,
        preferredDealer: formData.get("preferredDealer") || vehicle.preferredDealer,
        pickupLocation: formData.get("pickupLocation") || vehicle.pickupLocation,
        nextService: formData.get("nextService") || vehicle.nextService,
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
          ["Market value", savedVehicle?.marketValue || formData.get("marketValue") || vehicle.marketValue || "Value pending"],
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
        notes: `Member requested an offer. Current market value: ${vehicle.marketValue || "Value pending"}. Mileage: ${vehicle.mileage || "Mileage pending"}. VIN: ${vehicle.vin || "Needed"}. Location: ${vehicle.location || "Needed"}. Horsepower: ${vehicle.horsepower || "HP pending"}.`,
      });
      setOfferRequested(true);
      onComplete?.({
        actionLabel: "View Requests",
        actionTab: "schedule",
        details: [
          ["Request", savedRequest?.service || "Vehicle offer request"],
          ["Vehicle", savedRequest?.vehicle || vehicleLabel],
          ["Market value", vehicle.marketValue || "Value pending"],
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

  return (
    <div className="app-stack">
      <section className="vehicle-detail-hero">
        <button className="text-button" type="button" onClick={onBack}>Back to Garage</button>
        <img alt={vehicleLabel} onError={handleImageError} src={photoPreview || vehicle.image || fallbackVehicleImage} />
        <div>
          <span>{vehicle.use || "Collection"}</span>
          <h2>{vehicleLabel}</h2>
          <p>{vehicle.status || "Active"}</p>
        </div>
      </section>

      <section className="vehicle-stat-grid">
        <article>
          <strong>{vehicle.marketValue || "Value pending"}</strong>
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
  return (
    <article className="request-card">
      <div>
        <span>{appointment.status}</span>
        <h3>{appointment.service}</h3>
        <p>{appointment.vehicle}</p>
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
