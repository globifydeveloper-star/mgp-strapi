const fs = require('fs');
const path = require('path');

const gvfTsx = `"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import './GoldValueForm.css';
import LocationPopup from './LocationPopup';

interface GoldValueFormProps {
  sectionImage?: string;
  heading?: string;
  headingHighlight?: string;
  note?: string;
}

interface PurityOption {
  label: string;
  karat: string;
  fineness: string;
  purityPerc: number;
}

const PURITY_OPTIONS: PurityOption[] = [
  { label: '24K (999)', karat: '24K', fineness: '999', purityPerc: 99 },
  { label: '22K (916)', karat: '22K', fineness: '916', purityPerc: 91.6 },
  { label: '18K (750)', karat: '18K', fineness: '750', purityPerc: 75 },
];

interface QuoteData {
  purchasePrice: number;
  preGstAmount: number;
  gstAmount: number;
  totalQuoteAmt: number;
}

export default function GoldValueForm({ sectionImage, heading, headingHighlight, note }: GoldValueFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    purity: '24K (999)',
    weight: '',
  });

  const [selectedPurity, setSelectedPurity] = useState<PurityOption>(PURITY_OPTIONS[0]);
  const [liveTodayRate, setLiveTodayRate] = useState<{ price: number | null; loading: boolean; error: boolean }>({
    price: null,
    loading: true,
    error: false,
  });

  const [quoteState, setQuoteState] = useState<{
    data: QuoteData | null;
    loading: boolean;
    error: string | null;
  }>({
    data: null,
    loading: false,
    error: null,
  });

  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Fetch live 24K baseline rate on mount for the badge
  useEffect(() => {
    let isMounted = true;
    const fetchLiveBaselineRate = async () => {
      try {
        const res = await fetch('/api/gold-quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ weightInGms: 1, purityPerc: 99 }),
        });
        const json = await res.json();
        if (isMounted) {
          if (json.success && json.respData) {
            const price = Number(json.respData.purchasePrice || json.respData.totalQuoteAmt);
            setLiveTodayRate({ price, loading: false, error: false });
          } else {
            setLiveTodayRate({ price: null, loading: false, error: true });
          }
        }
      } catch {
        if (isMounted) {
          setLiveTodayRate({ price: null, loading: false, error: true });
        }
      }
    };

    fetchLiveBaselineRate();
    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Debounced quote calculation when weight or purity changes
  const executeQuoteCalculation = useCallback(async (weightVal: string, purityPercVal: number) => {
    const numericWeight = parseFloat(weightVal);
    if (!numericWeight || numericWeight <= 0) {
      setQuoteState({ data: null, loading: false, error: null });
      return;
    }

    setQuoteState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const res = await fetch('/api/gold-quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weightInGms: numericWeight,
          purityPerc: purityPercVal,
        }),
      });

      const json = await res.json();
      if (json.success && json.respData) {
        setQuoteState({
          data: {
            purchasePrice: Number(json.respData.purchasePrice) || 0,
            preGstAmount: Number(json.respData.preGstAmount) || 0,
            gstAmount: Number(json.respData.gstAmount) || 0,
            totalQuoteAmt: Number(json.respData.totalQuoteAmt) || 0,
          },
          loading: false,
          error: null,
        });
      } else {
        setQuoteState({
          data: null,
          loading: false,
          error: json.message || 'Rate temporarily unavailable — please try again',
        });
      }
    } catch {
      setQuoteState({
        data: null,
        loading: false,
        error: 'Rate temporarily unavailable — please try again',
      });
    }
  }, []);

  const handlePurityChange = (option: PurityOption) => {
    setSelectedPurity(option);
    setFormData((prev) => ({ ...prev, purity: option.label }));

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      executeQuoteCalculation(formData.weight, option.purityPerc);
    }, 500);
  };

  const handleWeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setFormData((prev) => ({ ...prev, weight: val }));

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      executeQuoteCalculation(val, selectedPurity.purityPerc);
    }, 500);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.phone || !formData.purity || !formData.weight) {
      alert('Please fill in all required fields.');
      return;
    }
    // Option A: Open LocationPopup to submit the valuation lead to Strapi
    setIsLocationModalOpen(true);
  };

  return (
    <section className="gvf-section" id="gold-value-form">
      <div className="gvf-pattern-band gvf-pattern-top" aria-hidden="true" />
      <div className="gvf-pattern-band gvf-pattern-bottom" aria-hidden="true" />
      <div className="container">
        <h2 className="gvf-heading">
          {heading || "Estimate The Value Of"}{' '}
          <span className="gvf-heading-highlight">{headingHighlight || "Your Gold"}</span>
        </h2>

        <div className="gvf-grid">
          {/* Left: Gold image with live rate badge */}
          <div className="gvf-image-col">
            <div className="gvf-image-wrap">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={sectionImage || "/bangle.png"} alt="Gold bangles" className="gvf-image" />
            </div>

            <div className="gvf-rate-badge">
              <div className="gvf-rate-badge-header">
                <span className="gvf-rate-badge-title">Today&apos;s Gold Rate</span>
                <span className="gvf-live-pill">
                  <span className="gvf-live-dot" />
                  Live
                </span>
              </div>
              <div className="gvf-rate-purity">24K (999)</div>
              <div className="gvf-rate-value">
                {liveTodayRate.loading ? (
                  <span className="gvf-rate-loading-text">Loading rate...</span>
                ) : liveTodayRate.error || liveTodayRate.price === null ? (
                  <span className="gvf-rate-error-text">Rate unavailable</span>
                ) : (
                  <>
                    <span className="gvf-rupee">
                      ₹{liveTodayRate.price.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                    </span>
                    <span className="gvf-rate-unit">/g</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Right: Estimate form */}
          <div className="gvf-form-col">
            <form className="gvf-form" onSubmit={handleSubmit}>
              {/* Animated Glowing border beam (aura/shine effect) */}
              <svg
                className="gvf-gold-beam-svg"
                viewBox="0 0 430 520"
                preserveAspectRatio="none"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <defs>
                  <linearGradient id="gvf-shine-gradient" x1="-100%" y1="-100%" x2="0%" y2="0%">
                    <animate attributeName="x1" from="-100%" to="200%" dur="4s" repeatCount="indefinite" />
                    <animate attributeName="y1" from="-100%" to="200%" dur="4s" repeatCount="indefinite" />
                    <animate attributeName="x2" from="0%" to="300%" dur="4s" repeatCount="indefinite" />
                    <animate attributeName="y2" from="0%" to="300%" dur="4s" repeatCount="indefinite" />

                    <stop offset="0%" stopColor="#EBAF20" stopOpacity="0" />
                    <stop offset="40%" stopColor="#EBAF20" stopOpacity="0" />
                    <stop offset="50%" stopColor="#FFD778" stopOpacity="1" />
                    <stop offset="60%" stopColor="#EBAF20" stopOpacity="0" />
                    <stop offset="100%" stopColor="#EBAF20" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <rect
                  x="1"
                  y="1"
                  width="428"
                  height="518"
                  rx="20"
                  fill="none"
                  stroke="url(#gvf-shine-gradient)"
                  className="gvf-gold-beam-rect"
                />
              </svg>

              <div className="gvf-field">
                <label htmlFor="gvf-name" className="gvf-label">Name<span className="gvf-required">*</span></label>
                <input
                  id="gvf-name"
                  name="name"
                  type="text"
                  required
                  className="gvf-input"
                  placeholder="Full Name"
                  value={formData.name}
                  onChange={handleChange}
                />
              </div>

              <div className="gvf-field">
                <label htmlFor="gvf-phone" className="gvf-label">Phone Number<span className="gvf-required">*</span></label>
                <input
                  id="gvf-phone"
                  name="phone"
                  type="tel"
                  required
                  className="gvf-input"
                  placeholder="Enter your Number"
                  value={formData.phone}
                  onChange={handleChange}
                />
              </div>

              <div className="gvf-field">
                <label className="gvf-label">Select Purity<span className="gvf-required">*</span></label>
                <div className="gvf-purity-presets" role="radiogroup" aria-label="Select Purity">
                  {PURITY_OPTIONS.map((opt) => (
                    <button
                      key={opt.karat}
                      type="button"
                      className={\`gvf-purity-chip \${selectedPurity.karat === opt.karat ? 'gvf-purity-chip-active' : ''}\`}
                      onClick={() => handlePurityChange(opt)}
                    >
                      <span className="gvf-purity-chip-karat">{opt.karat}</span>
                      <span className="gvf-purity-chip-fineness">({opt.fineness})</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="gvf-field">
                <label htmlFor="gvf-weight" className="gvf-label">Weight In Grams<span className="gvf-required">*</span></label>
                <input
                  id="gvf-weight"
                  name="weight"
                  type="number"
                  min="0.1"
                  step="any"
                  required
                  className="gvf-input"
                  placeholder="Quantity (in grams)"
                  value={formData.weight}
                  onChange={handleWeightChange}
                />
              </div>

              {/* Inline Live Quote Calculation Status / Result */}
              {quoteState.loading && (
                <div className="gvf-quote-status gvf-quote-status-loading">
                  <span className="gvf-quote-spinner" />
                  <span>Fetching live quote...</span>
                </div>
              )}

              {!quoteState.loading && quoteState.error && (
                <div className="gvf-quote-status gvf-quote-status-error">
                  <span>{quoteState.error}</span>
                </div>
              )}

              {!quoteState.loading && !quoteState.error && quoteState.data && (
                <div className="gvf-quote-card">
                  <div className="gvf-quote-card-header">
                    <span className="gvf-quote-card-title">Live Valuation Quote</span>
                    <span className="gvf-quote-card-badge">Live API</span>
                  </div>
                  <div className="gvf-quote-card-amount">
                    ₹{quoteState.data.totalQuoteAmt.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </div>
                  <div className="gvf-quote-card-details">
                    <span>Base Rate: ₹{quoteState.data.purchasePrice.toLocaleString('en-IN', { maximumFractionDigits: 2 })}/g</span>
                    {quoteState.data.gstAmount > 0 && (
                      <span>GST: ₹{quoteState.data.gstAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                    )}
                  </div>
                </div>
              )}

              <button type="submit" className="gvf-submit-btn">Check Rate</button>

              <p className="gvf-form-note">{note || "Final Value may vary based on physical verification"}</p>
            </form>
          </div>
        </div>
      </div>
      <LocationPopup
        isOpen={isLocationModalOpen}
        onClose={() => setIsLocationModalOpen(false)}
        clientData={formData}
        onSuccess={() => {
          setFormData({
            name: '',
            phone: '',
            purity: '24K (999)',
            weight: '',
          });
          setQuoteState({ data: null, loading: false, error: null });
        }}
      />
    </section>
  );
}
`;

const gvfCss = `/* Estimate The Value Of Your Gold — Section */
.gvf-section {
  position: relative;
  background:
    radial-gradient(circle at 88% 12%, rgba(218, 161, 46, 0.28) 0%, transparent 42%),
    radial-gradient(circle at 6% 92%, rgba(218, 161, 46, 0.2) 0%, transparent 38%),
    linear-gradient(135deg, #0a1440 0%, #0c1a4a 45%, #16224f 100%);
  padding: 6rem 0 7.5rem;
  overflow: hidden;
}

.gvf-pattern-band {
  position: absolute;
  left: 0;
  width: 100%;
  height: 240px;
  background-color: #E8B84B;
  -webkit-mask-repeat: repeat, no-repeat;
  mask-repeat: repeat, no-repeat;
  -webkit-mask-size: 170px 170px, 100% 100%;
  mask-size: 170px 170px, 100% 100%;
  -webkit-mask-position: center, center;
  mask-position: center, center;
  -webkit-mask-composite: source-in;
  mask-composite: intersect;
  opacity: 0.3;
  pointer-events: none;
  z-index: 1;
}

.gvf-pattern-top {
  top: 0;
  -webkit-mask-image: url('/gcard_bg_pattern.png'), linear-gradient(to bottom, #000 0%, transparent 100%);
  mask-image: url('/gcard_bg_pattern.png'), linear-gradient(to bottom, #000 0%, transparent 100%);
}

.gvf-pattern-bottom {
  bottom: 0;
  -webkit-mask-image: url('/gcard_bg_pattern.png'), linear-gradient(to top, #000 0%, transparent 100%);
  mask-image: url('/gcard_bg_pattern.png'), linear-gradient(to top, #000 0%, transparent 100%);
}

.gvf-section .container {
  position: relative;
  z-index: 2;
}

.gvf-heading {
  text-align: center;
  font-size: 2.6rem;
  font-weight: 700;
  color: #ffffff;
  line-height: 1.2;
  margin-bottom: 3.5rem;
}

.gvf-heading-highlight {
  color: var(--gold-primary);
  font-weight: 800;
}

.gvf-grid {
  display: grid;
  grid-template-columns: 1.5fr 1fr;
  gap: 3rem;
  align-items: stretch;
  max-width: 1120px;
  margin: 0 auto;
}

/* Left column: image + floating rate badge */
.gvf-image-col {
  position: relative;
}

.gvf-image-wrap {
  width: 100%;
  aspect-ratio: 16 / 10.5;
  border-radius: 20px;
  overflow: hidden;
  box-shadow: 0 20px 45px rgba(0, 0, 0, 0.35);
}

.gvf-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.gvf-rate-badge {
  position: absolute;
  right: -1.5rem;
  bottom: 3.5rem;
  width: 260px;
  background: var(--gold-gradient);
  border-radius: 14px;
  padding: 1.1rem 1.4rem 1.3rem;
  box-shadow: 0 16px 32px rgba(0, 0, 0, 0.35);
  animation: gvf-badge-float 3.5s ease-in-out infinite;
}

@keyframes gvf-badge-float {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-8px);
  }
}

.gvf-rate-badge-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.85rem;
  gap: 0.5rem;
}

.gvf-rate-badge-title {
  font-size: 0.85rem;
  font-weight: 600;
  color: #14162E;
}

.gvf-live-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  background: #244153;
  border: 1px solid #4ADE80;
  color: #4ADE80;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  padding: 0.22rem 0.6rem;
  border-radius: 9999px;
  flex-shrink: 0;
}

.gvf-live-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #4ADE80;
  display: inline-block;
  animation: pulse 1.8s infinite;
}

.gvf-rate-purity {
  font-size: 0.8rem;
  font-weight: 500;
  color: rgba(0, 0, 0, 0.75);
  margin-bottom: 0.3rem;
}

.gvf-rate-value {
  display: flex;
  align-items: baseline;
}

.gvf-rupee {
  font-size: 1.9rem;
  font-weight: 800;
  color: #14162E;
  letter-spacing: -0.01em;
}

.gvf-rate-unit {
  font-size: 0.95rem;
  font-weight: 800;
  color: rgba(0, 0, 0, 0.75);
  margin-left: 0.15rem;
}

.gvf-rate-loading-text {
  font-size: 0.9rem;
  font-weight: 600;
  color: rgba(20, 22, 46, 0.7);
}

.gvf-rate-error-text {
  font-size: 0.9rem;
  font-weight: 600;
  color: #c0392b;
}

/* Right column: form card */
.gvf-form-col {
  position: relative;
  display: flex;
}

.gvf-form {
  position: relative;
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  background: linear-gradient(135deg, #06132E 0%, #0F224C 50%, #163376 100%);
  border: 1px solid rgba(241, 185, 51, 0.35);
  border-radius: 20px;
  padding: 1.5rem 2rem;
  overflow: hidden;
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}

/* Animated Golden Beam overlay traversing the border */
.gvf-gold-beam-svg {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 2;
  overflow: visible;
}

.gvf-gold-beam-rect {
  stroke-width: 2px;
  filter: drop-shadow(0 0 3px rgba(235, 175, 32, 0.4)) drop-shadow(0 0 6px rgba(235, 175, 32, 0.2));
  opacity: 0.9;
}

.gvf-field {
  position: relative;
  z-index: 1;
  margin-bottom: 0.85rem;
}

.gvf-label {
  display: block;
  font-size: 0.85rem;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.85);
  margin-bottom: 0.35rem;
}

.gvf-required {
  color: var(--gold-primary);
  margin-left: 2px;
}

.gvf-input {
  width: 100%;
  background: rgba(15, 28, 65, 0.4);
  border: 1px solid rgba(241, 185, 51, 0.45);
  border-radius: 8px;
  padding: 0.6rem 1rem;
  color: #ffffff;
  font-size: 0.92rem;
  font-family: inherit;
  outline: none;
  transition: var(--transition-smooth);
}

.gvf-input::placeholder {
  color: rgba(255, 255, 255, 0.4);
}

.gvf-input:focus {
  border-color: var(--gold-primary);
  background: rgba(255, 255, 255, 0.05);
  box-shadow: 0 0 0 3px rgba(241, 185, 51, 0.15);
}

/* Purity Presets Chip Buttons */
.gvf-purity-presets {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem;
}

.gvf-purity-chip {
  background: rgba(15, 28, 65, 0.5);
  border: 1px solid rgba(241, 185, 51, 0.35);
  border-radius: 8px;
  padding: 0.5rem 0.25rem;
  color: #ffffff;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  transition: all 0.2s ease-in-out;
  font-family: inherit;
}

.gvf-purity-chip:hover {
  background: rgba(241, 185, 51, 0.12);
  border-color: var(--gold-primary);
}

.gvf-purity-chip-active {
  background: var(--gold-gradient) !important;
  border-color: transparent !important;
  color: #0c1835 !important;
  box-shadow: 0 4px 12px rgba(218, 161, 46, 0.25);
}

.gvf-purity-chip-karat {
  font-size: 0.88rem;
  font-weight: 700;
}

.gvf-purity-chip-fineness {
  font-size: 0.72rem;
  opacity: 0.85;
}

/* Quote Status & Result Card */
.gvf-quote-status {
  position: relative;
  z-index: 1;
  padding: 0.55rem 0.75rem;
  border-radius: 8px;
  font-size: 0.8rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.65rem;
}

.gvf-quote-status-loading {
  background: rgba(241, 185, 51, 0.1);
  border: 1px solid rgba(241, 185, 51, 0.25);
  color: #FFD778;
}

.gvf-quote-status-error {
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid rgba(239, 68, 68, 0.35);
  color: #FCA5A5;
}

.gvf-quote-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 215, 120, 0.3);
  border-top-color: #FFD778;
  border-radius: 50%;
  animation: gvf-spin 0.8s linear infinite;
}

@keyframes gvf-spin {
  to {
    transform: rotate(360deg);
  }
}

.gvf-quote-card {
  position: relative;
  z-index: 1;
  background: linear-gradient(135deg, rgba(235, 175, 32, 0.15) 0%, rgba(15, 34, 76, 0.6) 100%);
  border: 1px solid rgba(241, 185, 51, 0.45);
  border-radius: 10px;
  padding: 0.75rem 1rem;
  margin-bottom: 0.75rem;
}

.gvf-quote-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.25rem;
}

.gvf-quote-card-title {
  font-size: 0.78rem;
  font-weight: 600;
  color: #FFD778;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.gvf-quote-card-badge {
  font-size: 0.65rem;
  font-weight: 700;
  background: rgba(74, 222, 128, 0.15);
  border: 1px solid #4ADE80;
  color: #4ADE80;
  padding: 0.1rem 0.45rem;
  border-radius: 9999px;
}

.gvf-quote-card-amount {
  font-size: 1.45rem;
  font-weight: 800;
  color: #ffffff;
  line-height: 1.2;
}

.gvf-quote-card-details {
  display: flex;
  gap: 0.75rem;
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.7);
  margin-top: 0.25rem;
}

.gvf-submit-btn {
  position: relative;
  z-index: 1;
  width: 100%;
  margin-top: 0.2rem;
  background: var(--gold-gradient);
  color: #0c1835;
  border: none;
  border-radius: 10px;
  padding: 0.75rem;
  font-size: 1rem;
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;
  box-shadow: 0 8px 20px rgba(218, 161, 46, 0.3);
  transition: var(--transition-smooth);
}

.gvf-submit-btn:hover {
  background: var(--gold-gradient-hover);
  transform: translateY(-2px);
  box-shadow: 0 10px 24px rgba(218, 161, 46, 0.4);
}

.gvf-form-note {
  position: relative;
  z-index: 1;
  text-align: center;
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.45);
  margin-top: 0.6rem;
}

/* Responsive */
@media (max-width: 1024px) {
  .gvf-grid {
    grid-template-columns: 1fr;
    gap: 4rem;
  }

  .gvf-image-col {
    padding-bottom: 3rem;
  }
}

@media (max-width: 640px) {
  .gvf-section {
    padding: 4rem 0 5rem;
  }

  .gvf-heading {
    font-size: 2rem;
    margin-bottom: 3rem;
  }

  .gvf-rate-badge {
    right: 0.75rem;
    width: 210px;
    padding: 0.9rem 1.1rem 1.1rem;
  }

  .gvf-rupee {
    font-size: 1.5rem;
  }

  .gvf-form {
    padding: 1.75rem 1.5rem;
  }
}

@media (max-width: 480px) {
  .gvf-section {
    padding: 3rem 0 4rem;
  }
  .gvf-heading {
    font-size: 1.75rem;
  }
  .gvf-rate-badge {
    width: 100%;
    position: relative;
    right: 0;
    bottom: 0;
    margin-top: -20px;
    z-index: 3;
    border-radius: 12px;
  }
}
`;

const componentDir = 'd:/MGP/MGP-WEB/src/components/home/GoldValueForm';
fs.writeFileSync(path.join(componentDir, 'GoldValueForm.tsx'), gvfTsx, 'utf8');
console.log('Updated GoldValueForm.tsx');

fs.writeFileSync(path.join(componentDir, 'GoldValueForm.css'), gvfCss, 'utf8');
console.log('Updated GoldValueForm.css');
