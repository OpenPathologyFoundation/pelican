# Risk Management Plan

---
document_id: RMP-001
title: Digital Viewer Module — Risk Management Plan
version: 1.0
status: ACTIVE
owner: Quality Assurance
created_date: 2026-01-21
effective_date: 2026-01-21
trace_source: SRS-001 (System Requirements)
trace_destination: RMF-001 (Hazard Analysis)
references:
  - ISO 14971:2019 (Risk Management for Medical Devices)
  - IEC 62304:2006+A1:2015 (Section 7 — Software Risk Management)
  - FDA Guidance: Applying Human Factors to Medical Devices
---

## 1. Purpose

This document establishes the risk management framework for the Digital Viewer Module, including severity and probability scoring criteria, risk acceptability thresholds, and ALARP (As Low As Reasonably Practicable) criteria.

## 2. Scope

This Risk Management Plan applies to:
- All hazards associated with the Digital Viewer Module
- Software anomalies that could lead to patient harm
- Cybersecurity threats affecting patient safety
- Usability risks in clinical workflows

## 3. Severity Scoring Criteria

| Score | Level | Definition | Patient Impact Example |
|:------|:------|:-----------|:-----------------------|
| 5 | Catastrophic | Death or permanent life-threatening injury | — |
| 4 | Critical | Permanent impairment or life-threatening injury | Missed cancer diagnosis leading to delayed treatment |
| 3 | Serious | Injury requiring medical intervention | Incorrect measurement leading to unnecessary surgery |
| 2 | Minor | Temporary injury, no medical intervention | Temporary confusion resolved by verification |
| 1 | Negligible | Inconvenience, no injury | Minor workflow delay |

## 4. Probability Scoring Criteria

### 4.1 Standard Probability Scale

| Score | Level | Frequency |
|:------|:------|:----------|
| 5 | Frequent | ≥ 1 in 100 uses |
| 4 | Probable | 1 in 100 to 1 in 1,000 uses |
| 3 | Occasional | 1 in 1,000 to 1 in 10,000 uses |
| 2 | Remote | 1 in 10,000 to 1 in 100,000 uses |
| 1 | Improbable | < 1 in 100,000 uses |

### 4.2 Software-Specific Probability (P1 × P2)

> **CRITICAL**: Software doesn't "wear out" — a bug is present 100% or 0% of the time.

For software hazards, probability is split into:

- **P1**: Probability of the software anomaly occurring
  - Assume P1 = 1.0 (100%) if the bug could exist
  - You cannot argue code is "unlikely to fail"

- **P2**: Probability that IF the anomaly occurs, it leads to harm
  - This is where architectural controls reduce risk
  - Example: If bad measurement occurs, does user verify before diagnosis?

**Risk Score = Severity × P2** (assuming P1 = 1.0 for software)

| P2 Score | Definition | Example |
|:---------|:-----------|:--------|
| 5 | Very likely to cause harm | No verification step; single point of failure |
| 4 | Likely to cause harm | Limited verification; time pressure |
| 3 | May cause harm | Partial verification available |
| 2 | Unlikely to cause harm | Multiple verification layers |
| 1 | Very unlikely to cause harm | Comprehensive safeguards; must bypass multiple controls |

## 5. Risk Acceptability Matrix

| | Severity 1 | Severity 2 | Severity 3 | Severity 4 | Severity 5 |
|:--------|:-----------|:-----------|:-----------|:-----------|:-----------|
| **P2 = 5** | Medium (5) | High (10) | High (15) | Critical (20) | Critical (25) |
| **P2 = 4** | Low (4) | Medium (8) | High (12) | Critical (16) | Critical (20) |
| **P2 = 3** | Low (3) | Medium (6) | Medium (9) | High (12) | Critical (15) |
| **P2 = 2** | Low (2) | Low (4) | Medium (6) | Medium (8) | High (10) |
| **P2 = 1** | Low (1) | Low (2) | Low (3) | Low (4) | Medium (5) |

### 5.1 Risk Level Definitions

| Level | Score Range | Acceptability | Action Required |
|:------|:------------|:--------------|:----------------|
| **Critical** | 15-25 | UNACCEPTABLE | Mandatory risk reduction before release |
| **High** | 10-14 | UNACCEPTABLE | Risk reduction required; residual must be Medium or lower |
| **Medium** | 5-9 | CONDITIONALLY ACCEPTABLE | ALARP analysis required; documented justification |
| **Low** | 1-4 | ACCEPTABLE | Monitor; no specific action required |

## 6. ALARP Criteria

For Medium-risk hazards, ALARP analysis requires documentation of:

1. **Risk Reduction Considered**: What additional controls were evaluated?
2. **Impracticability Assessment**: Why are additional controls not implemented?
   - Technical infeasibility
   - Disproportionate cost relative to benefit
   - Negative impact on essential performance
3. **Benefit-Risk Analysis**: Does the benefit of the device outweigh residual risk?
4. **Comparison to State of Art**: Is residual risk comparable to similar devices?

## 7. Risk Control Categories

| Category | Description | Example |
|:---------|:------------|:--------|
| **Inherent Safety** | Design eliminates hazard | No server endpoint for Tier 1 data |
| **Protective Measures** | Automatic safeguards | Block measurements on uncalibrated slides |
| **Information for Safety** | Warnings, indicators | Focus declaration banner, calibration display |
| **Training** | User education | Diagnostic Mode workflow training |

**Priority Order**: Prefer inherent safety over protective measures over information.

## 8. Hazard Categories

### 8.1 Clinical Hazards

| Category | Examples |
|:---------|:---------|
| Case-Image Mismatch | Wrong patient case examined; diagnosis assigned to wrong patient |
| Measurement Error | Incorrect tumor depth; wrong margin distance |
| Missed Finding | Inadequate coverage; hidden annotations |
| Delayed Diagnosis | System unavailability; workflow disruption |

### 8.2 Data Governance Hazards

| Category | Examples |
|:---------|:---------|
| Privacy Breach | Navigation data retained and disclosed |
| Litigation Exposure | Viewing patterns used as "diligence evidence" |
| PHI Unauthorized Access | Tile access without authorization |

### 8.3 Cybersecurity Hazards

| Category | Examples |
|:---------|:---------|
| Session Hijacking | Attacker views patient data |
| Data Tampering | Annotation falsification |
| Denial of Service | System unavailable during diagnosis |

## 9. Risk Control Verification

All risk controls must be verified through:
- Design verification testing (functional tests)
- Code review (for inherent safety controls)
- Usability testing (for information-based controls)
- Security testing (for cybersecurity controls)

Verification results are documented in [06-VVP.md](./06-VVP.md).

## 10. Residual Risk Evaluation

After all risk controls are implemented:
1. Calculate residual risk score
2. Verify residual risk is acceptable per matrix
3. For Medium residual risks, complete ALARP documentation
4. Overall benefit-risk analysis confirms device benefit exceeds total residual risk

## 11. Post-Market Risk Monitoring

Risk management continues post-release:
- User feedback and complaints
- Incident reports
- Software anomaly tracking
- Periodic risk file review (annual minimum)

New hazards identified post-market are added to the Hazard Analysis.

## 12. Document Control

This Risk Management Plan is reviewed:
- Annually (minimum)
- Upon significant design changes
- Upon identification of new hazard categories
- Upon regulatory or standards updates

## 13. Revision History

| Version | Date | Author | Description |
|:--------|:-----|:-------|:------------|
| 1.0 | 2026-01-21 | QA | Initial Risk Management Plan |

---

**Document Control**: This is a controlled document. Changes require review and approval per SOP-DHF-Management.
