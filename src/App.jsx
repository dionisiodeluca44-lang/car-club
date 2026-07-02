import React, { useMemo, useState } from "react";
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

const services = [
  {
    icon: ClipboardCheck,
    title: "Collection Management",
    items: ["Monthly inspections", "Service records", "Exercise drives", "Market value reports", "Buying and selling help"],
  },
  {
    icon: Wrench,
    title: "Maintenance Concierge",
    items: ["Oil changes", "Scheduled maintenance", "Brake inspections", "Battery checks", "Recall monitoring"],
  },
  {
    icon: Sparkles,
    title: "Detailing",
    items: ["Exterior wash", "Interior cleaning", "Paint correction", "Ceramic coating", "Engine bay cleaning"],
  },
  {
    icon: KeyRound,
    title: "Pickup & Delivery",
    items: ["Vehicle pickup", "Service transport", "Detailing drop-off", "Return delivery", "Priority scheduling"],
  },
  {
    icon: Gauge,
    title: "Tire Concierge",
    items: ["Seasonal changes", "Tire storage", "Balancing", "Pressure checks", "Condition reports"],
  },
  {
    icon: Warehouse,
    title: "Storage Services",
    items: ["Winter storage", "Climate options", "Battery tender", "Monthly checkups", "Pressure maintenance"],
  },
  {
    icon: ShieldCheck,
    title: "Emergency Concierge",
    items: ["Towing help", "Repair coordination", "Insurance claim support", "Rental assistance", "Status updates"],
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

const benefits = [
  "Save time",
  "Protect vehicle value",
  "Never miss maintenance",
  "One contact for everything",
  "Premium care for every vehicle",
  "Better records for resale",
  "Less stress",
  "Ideal for collectors",
];

const reportItems = ["Photos", "Tire condition", "Brake condition", "Battery condition", "Fluid levels", "Recommended repairs", "Completed work", "Next service timing"];

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

function App() {
  const [mode, setMode] = useState("site");
  const [menuOpen, setMenuOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [member, setMember] = useState(() => {
    const saved = localStorage.getItem("carClubMember");
    return saved ? JSON.parse(saved) : null;
  });
  const [garage, setGarage] = useState(() => {
    const saved = localStorage.getItem("carClubGarage");
    return saved ? JSON.parse(saved) : defaultGarage;
  });
  const [appointments, setAppointments] = useState(() => {
    const saved = localStorage.getItem("carClubAppointments");
    return saved ? JSON.parse(saved) : defaultAppointments;
  });

  const closeMenu = () => setMenuOpen(false);

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

  function handleLogin(profile) {
    localStorage.setItem("carClubMember", JSON.stringify(profile));
    localStorage.setItem("carClubGarage", JSON.stringify(garage));
    localStorage.setItem("carClubAppointments", JSON.stringify(appointments));
    setMember(profile);
    setMode("app");
  }

  function handleLogout() {
    localStorage.removeItem("carClubMember");
    setMember(null);
    setMode("site");
  }

  function addVehicle(vehicle) {
    const nextGarage = [{ ...vehicle, id: crypto.randomUUID(), status: "New vehicle added", workDone: vehicle.workDone || [] }, ...garage];
    localStorage.setItem("carClubGarage", JSON.stringify(nextGarage));
    setGarage(nextGarage);
  }

  function updateVehicle(vehicleId, updates) {
    const nextGarage = garage.map((vehicle) => (vehicle.id === vehicleId ? { ...vehicle, ...updates } : vehicle));
    localStorage.setItem("carClubGarage", JSON.stringify(nextGarage));
    setGarage(nextGarage);
  }

  function addAppointment(appointment) {
    const nextAppointments = [{ ...appointment, id: crypto.randomUUID(), status: "Requested" }, ...appointments];
    localStorage.setItem("carClubAppointments", JSON.stringify(nextAppointments));
    setAppointments(nextAppointments);
  }

  if (mode === "login") {
    return <LoginScreen onLogin={handleLogin} onBack={() => setMode("site")} />;
  }

  if (mode === "app" && member) {
    return <MemberApp appointments={appointments} garage={garage} member={member} onAddAppointment={addAppointment} onAddVehicle={addVehicle} onLogout={handleLogout} onUpdateVehicle={updateVehicle} />;
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
            <p className="eyebrow">Collection management, handled end to end</p>
            <h1>White Glove Collection Management</h1>
            <p className="hero-copy">
              A private vehicle concierge for collectors and multi-car owners. Upload your garage, track value and modifications, schedule detailing, tuning, storage, pickup, delivery, and full collection care from one member account.
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
              <strong>Garage</strong>
              <span>upload your collection</span>
            </div>
            <div>
              <strong>Book</strong>
              <span>detailing and tuning</span>
            </div>
            <div>
              <strong>Track</strong>
              <span>records and requests</span>
            </div>
          </div>
        </section>

        <section className="section app-preview-section">
          <div className="section-heading">
            <p className="eyebrow">Member app</p>
            <h2>Your collection, vehicle values, service schedule, and concierge team in one place.</h2>
          </div>
          <div className="app-preview-grid">
            <article>
              <Upload size={24} />
              <h3>Upload Your Collection</h3>
              <p>Add each vehicle with photos, mileage, horsepower, market value, and notes.</p>
            </article>
            <article>
              <CalendarCheck size={24} />
              <h3>Schedule Services</h3>
              <p>Request detailing, tuning, pickup, tire service, storage, or maintenance.</p>
            </article>
            <article>
              <ClipboardCheck size={24} />
              <h3>Track Requests</h3>
              <p>See service requests, vehicle value, upgrades, completed work, and concierge notes.</p>
            </article>
          </div>
        </section>

        <section className="section how">
          <div className="section-heading">
            <p className="eyebrow">How it works</p>
            <h2>You enjoy your cars. We take care of everything else.</h2>
          </div>
          <div className="steps">
            {[
              ["Join White Glove", "Choose a membership plan that fits how your collection is stored, driven, and maintained."],
              ["Upload Your Collection", "Build your garage with photos, value, horsepower, modifications, and service records."],
              ["Request Concierge Care", "Book collection inspections, detailing, tuning, pickup, delivery, storage, maintenance, and more."],
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
            <p className="eyebrow">Collection-first care</p>
            <h2>One concierge team for your full garage, records, value, and services.</h2>
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
            <h2>Simple plans now. Custom care as your needs grow.</h2>
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
            <h2>Built for collectors, seasonal owners, and multi-vehicle households.</h2>
            <p>
              Keep every vehicle ready, protected, documented, and properly exercised with a dedicated care plan. We coordinate storage, inspections, service schedules, records, buying support, and selling support through one trusted team.
            </p>
          </div>
        </section>

        <section className="section value">
          <div className="section-heading">
            <p className="eyebrow">Why join</p>
            <h2>A calmer way to own vehicles you care about.</h2>
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
            <h2>Every visit creates a clearer record of your vehicle's condition.</h2>
            <p>
              Members receive digital reports after service and checkups, making it easier to plan maintenance, understand condition, and preserve resale value.
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
        <button type="button" onClick={() => setMode(member ? "app" : "login")}>Open Member App</button>
      </footer>
    </div>
  );
}

function LoginScreen({ onBack, onLogin }) {
  function submitLogin(event) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    onLogin({
      name: formData.get("name") || "Member",
      email: formData.get("email") || "member@carclub.com",
      plan: formData.get("plan") || "Club Drive",
    });
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
        <p>For now this is a working prototype. Real secure accounts will be added with a backend such as Supabase or Firebase.</p>
        <form className="app-form" onSubmit={submitLogin}>
          <label>
            Full name
            <input name="name" type="text" placeholder="Dionisio De Luca" required />
          </label>
          <label>
            Email
            <input name="email" type="email" placeholder="you@example.com" required />
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
          <button className="button primary submit" type="submit">
            Enter App <ArrowRight size={18} />
          </button>
        </form>
      </section>
    </main>
  );
}

function MemberApp({ appointments, garage, member, onAddAppointment, onAddVehicle, onLogout, onUpdateVehicle }) {
  const [activeTab, setActiveTab] = useState("home");
  const vehicleOptions = useMemo(() => garage.map((vehicle) => `${vehicle.year} ${vehicle.make} ${vehicle.model}`), [garage]);

  return (
    <div className="mobile-app-shell">
      <aside className="app-sidebar">
        <div className="auth-brand">
          <span className="brand-mark">WG</span>
          <span>White Glove</span>
        </div>
        <nav>
          <AppNavButton active={activeTab === "home"} icon={Home} label="Home" onClick={() => setActiveTab("home")} />
          <AppNavButton active={activeTab === "garage"} icon={Car} label="Garage" onClick={() => setActiveTab("garage")} />
          <AppNavButton active={activeTab === "schedule"} icon={CalendarCheck} label="Schedule" onClick={() => setActiveTab("schedule")} />
          <AppNavButton active={activeTab === "services"} icon={Sparkles} label="Services" onClick={() => setActiveTab("services")} />
          <AppNavButton active={activeTab === "account"} icon={User} label="Account" onClick={() => setActiveTab("account")} />
        </nav>
      </aside>

      <main className="app-main">
        <header className="app-topbar">
          <div>
            <p className="eyebrow">Member app</p>
            <h1>{activeTab === "home" ? `Welcome, ${member.name.split(" ")[0]}` : tabTitle(activeTab)}</h1>
          </div>
          <button className="icon-button" type="button" aria-label="Notifications">
            <Bell size={20} />
          </button>
        </header>

        {activeTab === "home" && <Dashboard appointments={appointments} garage={garage} member={member} setActiveTab={setActiveTab} />}
        {activeTab === "garage" && <GarageScreen garage={garage} onAddVehicle={onAddVehicle} onUpdateVehicle={onUpdateVehicle} />}
        {activeTab === "schedule" && <ScheduleScreen appointments={appointments} onAddAppointment={onAddAppointment} vehicleOptions={vehicleOptions} />}
        {activeTab === "services" && <ServicesScreen setActiveTab={setActiveTab} />}
        {activeTab === "account" && <AccountScreen member={member} onLogout={onLogout} />}
      </main>

      <nav className="bottom-tabs" aria-label="App navigation">
        <AppNavButton active={activeTab === "home"} icon={Home} label="Home" onClick={() => setActiveTab("home")} />
        <AppNavButton active={activeTab === "garage"} icon={Car} label="Garage" onClick={() => setActiveTab("garage")} />
        <AppNavButton active={activeTab === "schedule"} icon={CalendarCheck} label="Book" onClick={() => setActiveTab("schedule")} />
        <AppNavButton active={activeTab === "services"} icon={Sparkles} label="Services" onClick={() => setActiveTab("services")} />
      </nav>
    </div>
  );
}

function Dashboard({ appointments, garage, member, setActiveTab }) {
  return (
    <div className="app-stack">
      <section className="member-hero">
        <div>
          <span>{member.plan} member</span>
          <h2>{garage.length} vehicles under care</h2>
          <p>Your concierge team is ready for detailing, tuning, pickup, storage, inspections, and maintenance requests.</p>
        </div>
        <button className="button primary" type="button" onClick={() => setActiveTab("schedule")}>Schedule Service</button>
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
          <strong>Active</strong>
          <span>Concierge status</span>
        </article>
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
          <button type="button" onClick={() => setActiveTab("garage")}>Manage</button>
        </div>
        <div className="garage-list compact">
          {garage.slice(0, 2).map((vehicle) => (
            <VehicleCard key={vehicle.id} vehicle={vehicle} />
          ))}
        </div>
      </section>
    </div>
  );
}

function GarageScreen({ garage, onAddVehicle, onUpdateVehicle }) {
  const [showForm, setShowForm] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const selectedVehicle = garage.find((vehicle) => vehicle.id === selectedVehicleId);

  if (selectedVehicle) {
    return (
      <VehicleDetailScreen
        onBack={() => setSelectedVehicleId("")}
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
            <h2>Your Garage</h2>
            <p>Upload your car collection with photos, mileage, notes, and usage type.</p>
          </div>
          <button className="button primary compact-button" type="button" onClick={() => setShowForm((open) => !open)}>
            <Plus size={18} /> Add Car
          </button>
        </div>
        {showForm && <VehicleForm onAddVehicle={onAddVehicle} onClose={() => setShowForm(false)} />}
        <div className="garage-list">
          {garage.map((vehicle) => (
            <VehicleCard key={vehicle.id} onSelect={() => setSelectedVehicleId(vehicle.id)} vehicle={vehicle} />
          ))}
        </div>
      </section>
    </div>
  );
}

function ScheduleScreen({ appointments, onAddAppointment, vehicleOptions }) {
  return (
    <div className="app-stack">
      <section className="app-section">
        <h2>Schedule Concierge Service</h2>
        <p>Request detailing, tuning, maintenance, pickup and delivery, tire services, storage, or collection support.</p>
        <ScheduleForm onAddAppointment={onAddAppointment} vehicleOptions={vehicleOptions} />
      </section>
      <section className="app-section">
        <div className="app-section-title">
          <h2>Requests</h2>
          <span>{appointments.length} total</span>
        </div>
        {appointments.map((appointment) => (
          <ServiceRequestCard appointment={appointment} key={appointment.id} />
        ))}
      </section>
    </div>
  );
}

function ServicesScreen({ setActiveTab }) {
  return (
    <div className="app-stack">
      <section className="app-section">
        <h2>Services You Can Book</h2>
        <p>Select a service category, then request it through the scheduling tab.</p>
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
    </div>
  );
}

function AccountScreen({ member, onLogout }) {
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
        <h2>Next Backend Features</h2>
        <ul className="next-list">
          <li>Secure login and signup</li>
          <li>Database for members, vehicles, and service requests</li>
          <li>Photo upload storage</li>
          <li>Admin dashboard for your team</li>
          <li>Push notifications and email updates</li>
        </ul>
      </section>
    </div>
  );
}

function VehicleForm({ onAddVehicle, onClose }) {
  const [imagePreview, setImagePreview] = useState("");

  function handleImage(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result);
    reader.readAsDataURL(file);
  }

  function submitVehicle(event) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    onAddVehicle({
      year: formData.get("year"),
      make: formData.get("make"),
      model: formData.get("model"),
        mileage: formData.get("mileage"),
        use: formData.get("use"),
        notes: formData.get("notes"),
        marketValue: formData.get("marketValue") || "Value pending",
        horsepower: formData.get("horsepower") || "HP pending",
        workDone: splitWorkList(formData.get("workDone")),
        image: imagePreview || "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=900&q=85",
    });
    event.currentTarget.reset();
    setImagePreview("");
    onClose();
  }

  return (
    <form className="app-form inline-form" onSubmit={submitVehicle}>
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

function ScheduleForm({ onAddAppointment, vehicleOptions }) {
  function submitAppointment(event) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    onAddAppointment({
      vehicle: formData.get("vehicle"),
      service: formData.get("service"),
      date: formData.get("date"),
      time: formData.get("time"),
      notes: formData.get("notes"),
    });
    event.currentTarget.reset();
  }

  return (
    <form className="app-form inline-form" onSubmit={submitAppointment}>
      <label>
        Vehicle
        <select name="vehicle" required>
          {vehicleOptions.map((vehicle) => (
            <option key={vehicle}>{vehicle}</option>
          ))}
        </select>
      </label>
      <div className="app-form-grid">
        <label>
          Service
          <select name="service" required>
            <option>Full detail</option>
            <option>Maintenance concierge</option>
            <option>Tuning / modifications</option>
            <option>Pickup and delivery</option>
            <option>Tire change / storage</option>
            <option>Vehicle storage</option>
            <option>Collection management</option>
            <option>Emergency concierge</option>
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
      <button className="button primary submit" type="submit">Request Service</button>
    </form>
  );
}

function VehicleCard({ onSelect, vehicle }) {
  return (
    <button className="vehicle-card" type="button" onClick={onSelect}>
      <img alt={`${vehicle.year} ${vehicle.make} ${vehicle.model}`} src={vehicle.image} />
      <div>
        <span>{vehicle.use}</span>
        <h3>{vehicle.year} {vehicle.make} {vehicle.model}</h3>
        <p>{vehicle.mileage} miles</p>
      </div>
      <strong>{vehicle.status}</strong>
    </button>
  );
}

function VehicleDetailScreen({ onBack, onUpdateVehicle, vehicle }) {
  const [photoPreview, setPhotoPreview] = useState("");
  const workDone = vehicle.workDone?.length ? vehicle.workDone : ["No work logged yet"];

  function handlePhoto(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(reader.result);
    reader.readAsDataURL(file);
  }

  function saveDetails(event) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    onUpdateVehicle(vehicle.id, {
      marketValue: formData.get("marketValue") || "Value pending",
      horsepower: formData.get("horsepower") || "HP pending",
      mileage: formData.get("mileage") || vehicle.mileage,
      status: formData.get("status") || vehicle.status,
      image: photoPreview || vehicle.image,
    });
    setPhotoPreview("");
  }

  function addWork(event) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const workItem = formData.get("workItem")?.trim();
    if (!workItem) return;
    const existingWork = vehicle.workDone?.length ? vehicle.workDone : [];
    onUpdateVehicle(vehicle.id, { workDone: [workItem, ...existingWork] });
    event.currentTarget.reset();
  }

  return (
    <div className="app-stack">
      <section className="vehicle-detail-hero">
        <button className="text-button" type="button" onClick={onBack}>Back to Garage</button>
        <img alt={`${vehicle.year} ${vehicle.make} ${vehicle.model}`} src={photoPreview || vehicle.image} />
        <div>
          <span>{vehicle.use}</span>
          <h2>{vehicle.year} {vehicle.make} {vehicle.model}</h2>
          <p>{vehicle.status}</p>
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
        <h2>Update Vehicle Details</h2>
        <form className="app-form inline-form" onSubmit={saveDetails}>
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
          </div>
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
          Tell us about your vehicles and the services you want handled. Our team will contact you shortly to build your custom vehicle care plan.
        </p>
        <div className="contact-strip">
          <span><MapPin size={18} /> Local concierge coverage</span>
          <span><CalendarCheck size={18} /> Priority scheduling</span>
          <span><ShieldCheck size={18} /> Preventive care</span>
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
            {["Maintenance", "Detailing", "Tuning/modifications", "Tire storage/change", "Vehicle storage", "Pickup and delivery", "Collection management", "Buying/selling assistance", "Other"].map((service) => (
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
    services: "Services",
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
