Major gaps for a clinical + educational + research WSI viewer

1) Image fidelity, color management, and display calibration (clinical-critical)

You talk about speed and navigation, but not diagnostic image fidelity requirements:
•	Color consist/cency across monitors/workstations (ICC profiles, white point, gamma), and guidance for acceptable display performance.
•	Brightness/contrast requirements and calibration workflows.
•	Handling of z-stacks, multiple focal planes, multiple stains, fluorescence (if in scope).

Why it matters: FDA’s technical performance guidance for WSI emphasizes characterizing performance aspects that can impact safety/effectiveness.  ￼

What to add: user needs around color accuracy, display validation status visibility, and “this display is not validated for Dx” gating.

⸻

2) Data integrity, audit trails, and compliance expectations

For clinical use, you’ll typically need:
•	Audit trail of case open/close, identity confirmation, annotation create/edit/delete, measurement actions (at least for shared artifacts).
•	Electronic records controls (often Part 11–like expectations in practice, plus institutional policies).
•	Retention, legal hold, and export controls.

You do say voice transcripts aren’t retained, but you don’t define what is retained (annotations? measurements? thumbnails? logs?) and who can access them.

⸻

3) Cybersecurity + access control (now expected as a design input)

Nothing in the user needs speaks to:
•	Role-based access control (attending vs trainee vs consultant vs admin).
•	Session timeout, MFA/SSO, least privilege.
•	Encryption in transit/at rest, secure cache behavior (WSI caching can leak PHI).
•	Update/patch expectations.

For health software, security lifecycle requirements like IEC 81001-5-1 are increasingly treated as table stakes for health software development.  ￼

⸻

4) Interoperability is underspecified (clinical + research)

“Integrate with LIS workflows” is too high-level. You need user needs that translate into SRS-level interfaces:
•	Worklist launch context (case opens from LIS, viewer deep-linking).
•	Standard formats/APIs: DICOM WSI and DICOMweb are increasingly relevant for vendor-neutral workflows.  ￼
•	Export options for research/teaching: OME-TIFF, pyramidal TIFF, OpenSlide compatibility (if in scope).
•	“Bring your own storage” vs internal archive expectations.

⸻

5) Validation and “intended use” boundaries are not separated by mode

You have “clinical mode” vs disable-with-attestation, but you need sharper boundaries:
•	What exactly changes between modes? (identity banner behavior, export watermarks, algorithm overlays, measurement permissibility, annotation sharing defaults, audit logging).
•	For education/research, what PHI handling rules apply (de-ID, limited datasets, slide sharing)?

Also, for nonclinical regulated contexts, there are explicit expectations about documentation and management of whole slide images in GLP-like settings.  ￼

⸻

6) Essential viewer features not mentioned (day-to-day pathology reality)

Common “must-haves” missing from the user needs list:
•	Magnification indicator + scale bar that reflects actual pixel spacing.
•	Focus map / tissue overview / minimap with orientation and quick navigation.
•	Slide label view (barcode + label image) and specimen part identification.
•	Keyboard shortcuts (pathologists rely on them).
•	Bookmarks (return to ROIs quickly).
•	Case notes & handoff (esp. resident→attending).
•	Search within case (find slide by part/block/stain).
•	Artifact reporting (flag scan issues: out-of-focus, tissue missing).
•	Network resilience (graceful degradation, offline/poor bandwidth behavior, cache controls).

⸻

7) Missing user profiles / stakeholders

Your personas are all physicians/informatics. For adoption, you usually need:
•	Lab manager / quality manager (validation, QC, compliance).
•	Histotechnologist / lab tech (slide label integrity, scan QC feedback loop).
•	IT/security admin (deployment constraints, monitoring, SSO).
•	External consultant pathologist (limited access, time-boxed sharing, licensing constraints).

⸻

Ambiguities / potential conflicts in your current needs
•	UN-SAF-005 “explicit confirmation before switching cases” vs UN-VWR-002 instantaneous navigation: confirmation dialogs can become latency and annoyance if not designed carefully. Consider configurable friction (e.g., confirm only when signed-out state is active, or when multiple cases open, or when switching from a Dx case).
•	UN-ANN-005 “annotations to never involuntarily appear on images” is good, but ambiguous: does this mean never burned into pixels on export? never shown by default? never shared automatically? You should split this into separate needs (default visibility vs export behavior vs sharing).
•	UN-RVW-004 assurance viewing patterns not tracked conflicts with security/audit requirements if interpreted too broadly. You can reconcile by stating: audit for safety/compliance exists, but not used as productivity scoring; analytics are aggregated/de-identified; users can see what’s logged.

⸻

Concrete additions: user needs you should strongly consider adding

Here are “drop-in” user needs (with suggested IDs) that round out clinical + edu + research:

Image fidelity & diagnostic confidence
•	UN-IMG-001 The user needs confidence that color and luminance are consistent and within validated tolerances on approved displays. (Critical)
•	UN-IMG-002 The user needs a visible indicator when the viewing environment is not validated for clinical diagnosis (e.g., unapproved display, disabled calibration, remote session). (High/Critical)
•	UN-IMG-003 The user needs a magnification indicator and scale bar that accurately reflect scanner pixel spacing at the current zoom. (High)

Identity, provenance, and slide integrity
•	UN-SAF-006 The user needs to view slide label/barcode metadata and scan QC status to confirm specimen identity and scan completeness. (High)
•	UN-SAF-007 The user needs clear provenance of the image (scanner model, scan date/time, rescan status, compression, pyramid levels). (High)

Security, privacy, and governance
•	UN-SEC-001 The user needs role-based access (view/annotate/share/export) aligned with institution policy. (Critical)
•	UN-SEC-002 The user needs secure session behavior (timeout/lock, re-auth for sensitive actions, safe caching on shared workstations). (High)
•	UN-SEC-003 The user needs transparency into what activity is logged and why (audit vs analytics), with controls appropriate to role. (High)

Interoperability & data movement
•	UN-INT-004 The user needs the viewer to open cases via LIS context (deep links) and return results/flags without duplicate entry. (High)
•	UN-INT-005 The user needs standards-based import/export and archive compatibility (e.g., DICOM WSI / DICOMweb where supported). (Medium/High)  ￼

Workflow essentials
•	UN-WFL-001 The user needs bookmarks/ROIs and quick navigation history to return to key fields efficiently. (High)
•	UN-WFL-002 The user needs fast keyboard-driven controls and configurable shortcuts for common actions. (High)
•	UN-WFL-003 The user needs to flag scan quality issues and request rescans or glass review with structured reasons. (Medium/High)

Education & research modes (explicitly)
•	UN-EDU-001 The user needs a teaching mode that can de-identify cases, control what is shared, and optionally watermark exports. (High)
•	UN-RSH-001 The user needs bulk export and programmatic access (within permissions) for research datasets, with provenance preserved. (Medium)

⸻

Structural improvements to the PURS itself
•	Add a short “Scope / Out of Scope” section (e.g., AI overlays, fluorescence, z-stack, telepathology live control, mobile/tablet use).
•	Add use scenarios (sign-out, consult, tumor board, resident preview, research export) and trace needs to scenarios.
•	Add hazard-linked needs (tie UN-SAF items to a hazard like wrong-patient/wrong-slide) so your ISO 14971 risk file and usability engineering work naturally connect.
•	Consider a separate section for non-functional requirements expressed as user needs (availability, recovery, offline, performance under constrained bandwidth), so they don’t get lost in SRS.

