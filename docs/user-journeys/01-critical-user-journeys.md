# Critical User Journeys: Data Product Teams on Ontos

This document outlines the complete lifecycle and workflows for data product teams using the Ontos platform. It is based on Data Mesh principles and aligns with Open Data Contract Standard (ODCS) and Open Data Product Specification (ODPS) standards.

---

## 1. TEAM COMPOSITION ANALYSIS

The structure of a data product team can vary based on the complexity of the data domain, the scope of the data product, and organizational maturity.

### Minimal Team (2-3 people)

This lean setup is common for initial prototypes, well-defined domains, or smaller organizations. Roles are fluid, with significant responsibility overlap.

| Role | Core Responsibilities | Overlapping Duties |
| :--- | :--- | :--- |
| **Data Product Owner** | Defines vision, roadmap, and business value. Manages stakeholder relationships. Prioritizes features and requirements. | Acts as the primary Business Analyst. May perform some data analysis and validation. Manages project backlog. |
| **Data Engineer** | Designs, builds, and maintains the data product pipeline, infrastructure, and data models. Implements data quality checks. | Responsible for operational monitoring, CI/CD, and ensuring adherence to the data contract. |
| **(Optional) Analyst/QA**| Focuses on data quality, validation, and testing. Creates sample queries and usage examples. | Often a shared responsibility between the Product Owner and Data Engineer. |

### Elaborate Team (5-8 people)

This structure is suited for complex, high-impact data products requiring robust governance, security, and consumer support. Roles are specialized, and communication is more structured.

| Role | Core Responsibilities | Communication Patterns |
| :--- | :--- | :--- |
| **Data Product Owner** | Owns the product vision, roadmap, and P&L. Is the primary interface for business stakeholders and consumers. | Leads sprint planning, reviews, and stakeholder demos. Communicates priorities to the team. |
| **Lead Data Engineer** | Provides technical leadership, architectural design, and mentorship. Oversees the entire technical stack of the product. | Works with the Product Owner on feasibility, translates requirements into technical tasks. Leads technical design sessions. |
| **Data Engineer (2-3)** | Implements data pipelines, transformations, and API endpoints. Writes unit and integration tests. | Daily stand-ups with the team. Pair programming and code reviews with other engineers. |
| **Business Analyst** | Gathers detailed requirements from consumers. Defines acceptance criteria. Documents business logic and transformations. | Acts as a bridge between the Product Owner and the engineering team. |
| **QA / Test Engineer** | Develops and executes the test plan, including data quality, performance, and security testing. Automates testing where possible. | Works closely with engineers to identify bugs and with the Analyst to ensure requirements are met. |
| **Data Steward (Liaison)**| A formal (often federated) role to ensure the product meets governance, compliance, and quality standards. | The primary point of contact for the central governance team. Participates in review gates. |

---

## 2. WORKFLOW ANALYSIS

A key decision is whether to define the contract before or after building the product. Both approaches are supported and use the same Draft-state editing model: create the object, then compose and refine it over time on the detail page.

*   **Contracts First:** The team and consumers agree on the data contract (schema, SLOs, terms) *before* implementation begins. This ensures alignment and treats data as a true product with a defined interface. It decouples producers from consumers.
*   **Products First:** The team creates a Data Product in Draft status, then composes it by adding **Deliverables** (output ports) — each with a specific **Delivery Method** (e.g., "Table Access", "Serving Endpoint", "File Export"). Assets (Tables, Datasets, Views, ML Models, API Endpoints) are linked to individual Deliverables, not to the Data Product directly. This per-deliverable asset linking model makes access semantics explicit: when a consumer requests access to a Deliverable, they are granted access to all its underlying assets according to the Delivery Method. Contracts can be linked to each Deliverable later once the product shape is clear. The team also defines **Consumables** (input ports) to declare the product's upstream data dependencies. This approach is faster for exploration and lets the team compose the product from existing catalog assets before committing to a formal interface.

Both workflows use **Draft-state editing**: the object is created with minimal metadata, then enriched incrementally on the detail page. Ownership, versioning, and lifecycle states (Draft → Active) track progress. There is no wizard or multi-step creation flow — the detail page is the primary editing surface.

### Key Concepts

*   **Deliverables** (Output Ports): Named data outputs of a product, each with a Delivery Method. Assets are linked per Deliverable. Example: A "Customer Churn" product has Deliverables "Daily Churn Rate" (Table Access, 3 tables + 1 dataset), "Weekly Summary" (Table Access, 2 tables), and "ML Predictions" (Serving Endpoint).
*   **Consumables** (Input Ports): Declared upstream data dependencies that feed into the product's pipelines.
*   **Delivery Methods**: Reference data defining how data is delivered (e.g., Table Access, Serving Endpoint, File Export, Streaming). Configured under Settings → Reference Data → Delivery Methods.

### Minimal Workflow (Contracts First)

This workflow prioritizes speed and agility, with fewer formal handoffs.

| Step | Action | Lead Role | Timeline |
| :--- | :--- | :--- | :--- |
| 1 | **Draft Contract** | Product Owner | Day 1 |
| 2 | **Develop Product & Iterate** | Data Engineer | Day 1-5 |
| 3 | **Internal Review & Test** | Team | Day 6 |
| 4 | **Publish to Sandbox** | Data Engineer | Day 7 |
| 5 | **Propose for Certification** | Product Owner | Day 7 |
| 6 | **Steward Review** | Data Steward | Day 8-9 |
| 7 | **Publish to Catalog** | Product Owner | Day 10 |

### Elaborate Workflow (Contracts First with Approval Gates)

This workflow incorporates formal reviews and approvals, suitable for critical data products.

| Step | Action | Lead Role | Timeline | Approval Gate |
| :--- | :--- | :--- | :--- | :--- |
| 1 | **Define Requirements** | Business Analyst | Week 1 | Stakeholder Sign-off |
| 2 | **Draft Contract** | Product Owner | Week 2 | Consumer & Steward Review |
| 3 | **Approve Contract** | Data Steward | Week 2 | **[GATE] Contract Approved** |
| 4 | **Technical Design** | Lead Engineer | Week 3 | Architectural Review |
| 5 | **Develop Product** | Data Engineers | Week 3-5 | Code Reviews, Unit Tests |
| 6 | **QA & Validation** | QA Engineer | Week 6 | Test Plan Execution |
| 7 | **Publish to Sandbox** | Lead Engineer | Week 7 | **[GATE] Sandbox Ready** |
| 8 | **Submit for Certification** | Product Owner | Week 7 | Compliance Checklist |
| 9 | **Certify Product** | Data Steward | Week 8 | **[GATE] Product Certified** |
| 10 | **Deploy to Production** | Lead Engineer | Week 8 | CI/CD Pipeline |
| 11 | **Publish to Catalog** | Product Owner | Week 8 | **[GATE] Product Active** |

---

## 3. SEQUENCE DIAGRAMS

### Minimal Workflow Sequence Diagram

```
sequenceDiagram
    participant PO as Product Owner
    participant DE as Data Engineer
    participant Ontos as Ontos Platform
    participant Steward as Data Steward

    PO->>Ontos: Create Contract (Draft)
    PO->>DE: Discuss contract details
    DE->>Ontos: Build Product against contract
    PO->>Ontos: Propose Contract for Review
    Ontos-->>Steward: Notify: Contract Review Request
    Steward->>Ontos: Approve Contract
    Ontos-->>PO: Notify: Contract Approved
    DE->>Ontos: Deploy Product to Sandbox
    PO->>Ontos: Request Product Certification
    Ontos-->>Steward: Notify: Certification Request
    Steward->>Ontos: Certify Product
    Ontos-->>PO: Notify: Product Certified
    PO->>Ontos: Publish to Catalog (Active)
```

### Elaborate Workflow Sequence Diagram

```
sequenceDiagram
    participant BA as Business Analyst
    participant PO as Product Owner
    participant Consumer as Data Consumer
    participant Steward as Data Steward
    participant LeadDE as Lead Data Engineer
    participant DE as Data Engineer
    participant QA as QA Engineer
    participant Ontos as Ontos Platform

    BA->>Consumer: Gather Requirements
    BA->>PO: Finalize Requirements
    PO->>Ontos: Create Contract (Draft)
    PO->>Consumer: Share Draft for Feedback
    PO->>Ontos: Propose Contract for Review
    Ontos-->>Steward: Notify: Contract Review Request
    Steward->>Ontos: Approve Contract -> [GATE]
    Ontos-->>PO: Notify: Contract Approved
    LeadDE->>DE: Assign Development Tasks
    DE->>Ontos: Develop Product, Commit Code
    QA->>Ontos: Run Automated Tests
    LeadDE->>Ontos: Deploy to Sandbox
    PO->>Ontos: Request Product Certification
    Ontos-->>Steward: Notify: Certification Request
    Steward->>QA: Request Quality/Security Reports
    Steward->>Ontos: Certify Product -> [GATE]
    Ontos-->>PO: Notify: Product Certified
    LeadDE->>Ontos: Deploy to Production (CI/CD)
    PO->>Ontos: Publish to Catalog (Active) -> [GATE]
```

---

## 4. KEY QUESTIONS ANSWERED

### 1. How many team members work on defining a data product?

*   In a **minimal team**, **2-3 people** (Product Owner, Engineer) collaborate on the definition.
*   In an **elaborate team**, this can expand to **5-8**, including Analysts, QA, and Stewards.

### 2. Order of work: contracts first or products? Handover process?

*   The **Contracts First** approach is strongly recommended.
*   The handover process is managed by state transitions in Ontos: the Product Owner submits a `DRAFT` contract, which becomes `PROPOSED`, signaling to the Data Steward that it's ready for the review "handover."

### 3. Main lifecycle stages? Private vs public timing?

*   The main stages are: **Development** (private), **Review** (visible to stewards), **Certified** (metadata is public), and **Active** (fully public in the catalog).
*   Objects are private to the team until explicitly submitted for review.

### 4. When/how are stewards involved?

*   Stewards are involved at two key gates: **Contract Approval** and **Product Certification**.
*   They are engaged via a review request in Ontos and use a defined set of criteria to approve or reject submissions.

### 5. What other personas are common?

*   Beyond the core team, key personas include:
    - **Data Consumer** (the customer)
    - **Domain Owner** (the sponsor)
    - **Platform Engineer** (the enabler)
    - **Security Officer** (the guardian)
