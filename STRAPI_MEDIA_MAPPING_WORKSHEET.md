# Strapi Media Mapping Worksheet

Source: `migration-report.json` generated 2026-08-03. All 86 discovered files uploaded successfully. The report's `homepageAutoLink.linked` array is empty and contains an error, so Homepage mappings below still require manual attachment and Save in Strapi Admin.

## Homepage (single type)

| Field | Original filename | Media ID | Correct? |
|---|---|---:|---|
| heroFirstSlideImage | `hm6-img01.png` | 75 | ☐ |
| processSectionImage | `g_selling.png` | 19 | ☐ |
| estimateGoldImage | `bangle.png` | 9 | ☐ |
| vanImage | `van.png` from `MGP-WEB/public` | 35 | ☐ |
| ogImage | **Ambiguous — no existing homepage OG image reference found** | — | ☐ |

Evidence: these four mapped images are the exact current component fallbacks/imports. Do not assign `ogImage` without confirming the intended social-sharing artwork.

## hero-slide

| Slide # / identifying text | Field | Original filename | Media ID | Attached? |
|---|---|---|---:|---|
| Slide 1 — “Sell Your Gold. Get Cash Today.” | heroImage | `hm6-img01.png` | 75 | ☐ |
| Slide 2 — “Get 100% Value for Your Gold…” | heroImage | `golds.png` | 59 | ☐ |

## promo-slide

| Slide # / identifying text | Field | Original filename | Media ID | Attached? |
|---|---|---|---:|---|
| Slide 1 — “A Legacy Of / Trust, Truth & Tradition” | creativeImage | `van.png` from `MGP-WEB/public` | 35 | ☐ |
| Slide 2 — “Built On / Transparency & Fairness” | creativeImage | `woman-saree.png` | 42 | ☐ |
| Slide 3 — “Driven By / Customer First Values” | creativeImage | `g_selling.png` | 19 | ☐ |

## difference-box

| Box title | Field | Original filename | Media ID | Attached? |
|---|---|---|---:|---|
| XRF over touchstone | boxImage | `gcard1.png` | 14 | ☐ |
| Three-decimal weight | boxImage | `gcard2.png` | 15 | ☐ |
| Bank transfer, not cash-only | boxImage | `gcard3.png` | 16 | ☐ |

## testimonial

| Customer name | Field | Original filename | Media ID | Attached? |
|---|---|---|---:|---|
| SACHIN JONEJA | profilePicture | `sachin-joneja.png` | 32 | ☐ |
| Basvaraju | profilePicture | `Basvaraju.png` | 10 | ☐ |
| Srinarayan | profilePicture | `Srinarayan.png` | 33 | ☐ |
| Vijay Sharma | profilePicture | **No matching source image found** | — | ☐ |
| AMAR SINGH | profilePicture | `AMAR SINGH.png` | 8 | ☐ |

## Other uploaded homepage-related media

These files are not fields in the supplied worksheet, but are used by homepage code or may need separate scope review. They must not be attached to an unrelated field merely to exhaust the upload report.

| Usage | Original filename | Media ID | Status |
|---|---|---:|---|
| Process step 1 fallback | `g_selling.png` | 19 | ☐ review `process-step.stepImage` |
| Process step 2 fallback | `gcard1.png` | 14 | ☐ review `process-step.stepImage` |
| Process step 3 fallback | `gcard2.png` | 15 | ☐ review `process-step.stepImage` |
| Process step 4 fallback | `gcard3.png` | 16 | ☐ review `process-step.stepImage` |
| Process step 5 fallback | `rp_card1.png` | 29 | ☐ review `process-step.stepImage` |

## Unmatched/non-homepage uploads

The remaining report entries include navigation assets, decorative patterns, animation frames, other-page artwork, logos, and duplicate filenames from different source directories. They do not have a field in this S02 worksheet. Review them in Media Library before deletion; filename similarity alone is not sufficient evidence for attachment.

Notable duplicate-name pairs:

- `pattern2.png`: IDs 25 and 83
- `pattern4.png`: IDs 27 and 84
- `test.png`: IDs 34 and 90
- `van.png`: IDs 35 and 92 (different source files and sizes; do not assume they are duplicates)

## Cleanup pass

- [ ] Open Media Library and sort by upload date; identify true content duplicates.
- [ ] Delete duplicates only after confirming which media record is attached.
- [ ] Review unmatched/non-homepage assets against their actual page scope; do not force every uploaded asset into a homepage field.
- [ ] Revoke the `asset-migration` API token in Strapi Admin → API Tokens.
- [ ] Reload the homepage in incognito and confirm every CMS image renders without fallbacks or broken URLs.

