import React, { useState } from "react";
import {
  ArrowRight,
  BatteryCharging,
  CalendarCheck,
  Car,
  Check,
  ClipboardCheck,
  Diamond,
  Gauge,
  KeyRound,
  MapPin,
  Menu,
  Phone,
  ShieldCheck,
  Sparkles,
  Warehouse,
  Wrench,
  X,
} from "lucide-react";

const services = [
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
    icon: Diamond,
    title: "Tuning & Modifications",
    items: ["Wheels", "Suspension", "Exhaust", "Tint", "Wraps and paint protection"],
  },
  {
    icon: ShieldCheck,
    title: "Emergency Concierge",
    items: ["Towing help", "Repair coordination", "Insurance claim support", "Rental assistance", "Status updates"],
  },
  {
    icon: ClipboardCheck,
    title: "Collection Management",
    items: ["Monthly inspections", "Service records", "Exercise drives", "Market value reports", "Buying and selling help"],
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

const reportItems = [
  "Photos",
  "Tire condition",
  "Brake condition",
  "Battery condition",
  "Fluid levels",
  "Recommended repairs",
  "Completed work",
  "Next service timing",
];

function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState("");

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

  return (
    <div className="site-shell">
      <header className="nav">
        <a className="brand" href="#top" onClick={closeMenu} aria-label="Car Club home">
          <span className="brand-mark">CC</span>
          <span>
            <strong>Car Club</strong>
            <small>Vehicle Concierge</small>
          </span>
        </a>
        <button className="menu-toggle" type="button" onClick={() => setMenuOpen((open) => !open)} aria-label="Toggle navigation">
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
        <nav className={menuOpen ? "nav-links open" : "nav-links"} aria-label="Primary navigation">
          <a href="#services" onClick={closeMenu}>Services</a>
          <a href="#memberships" onClick={closeMenu}>Memberships</a>
          <a href="#collectors" onClick={closeMenu}>Collectors</a>
          <a href="#apply" onClick={closeMenu}>Apply</a>
        </nav>
      </header>

      <main id="top">
        <section className="hero">
          <div className="hero-media" aria-hidden="true" />
          <div className="hero-overlay" />
          <div className="hero-content">
            <p className="eyebrow">Premium car care, managed for you</p>
            <h1>Your Personal Car Concierge</h1>
            <p className="hero-copy">
              From maintenance and detailing to storage, tuning, pickup, delivery, and full collection management, we take care of your vehicles so you do not have to.
            </p>
            <div className="hero-actions">
              <a className="button primary" href="#apply">
                Become a Member <ArrowRight size={18} />
              </a>
              <a className="button secondary" href="#apply">
                Request a Consultation <Phone size={18} />
              </a>
            </div>
          </div>
          <div className="hero-panel" aria-label="Service highlights">
            <div>
              <strong>24h</strong>
              <span>priority response</span>
            </div>
            <div>
              <strong>360</strong>
              <span>vehicle care records</span>
            </div>
            <div>
              <strong>1</strong>
              <span>trusted point of contact</span>
            </div>
          </div>
        </section>

        <section className="section how">
          <div className="section-heading">
            <p className="eyebrow">How it works</p>
            <h2>You enjoy your cars. We take care of everything else.</h2>
          </div>
          <div className="steps">
            {[
              ["Join the Club", "Choose a monthly or yearly membership plan that fits the way you own and drive."],
              ["Tell Us About Your Vehicles", "Add one car or your full collection with the details we need to manage care properly."],
              ["We Handle Everything", "Maintenance, detailing, tire changes, storage, pickup, delivery, reminders, and reports."],
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
            <p className="eyebrow">Complete vehicle care</p>
            <h2>One concierge team for every service your vehicle needs.</h2>
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
            <h2>Every visit creates a clearer record of your vehicle’s condition.</h2>
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
              <span><BatteryCharging size={18} /> Preventive care</span>
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
      </main>

      <footer className="footer">
        <div>
          <strong>Car Club</strong>
          <span>Complete vehicle care, managed for you.</span>
        </div>
        <a href="#apply">Become a Member</a>
      </footer>
    </div>
  );
}

export default App;
