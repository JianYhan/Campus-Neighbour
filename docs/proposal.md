JC2001 Introduction to Software Engineering

Academic Year 2026–27

# Campus Neighbour Project Proposal

# Campus Second-Hand Trading Platform

| Project information | Details |
| --- | --- |
| Group number | [To be filled] |
| Programme of study | [To be filled] |
| Academic supervisor | [To be filled] |
| Proposal submission deadline | 25 September 2026, 23:59 CST |
| Project start and end dates | [To be filled] |
| Group members and student IDs | 1. YUHAN JIAO 50106173<br>2. ZIYE JIANG 50106131<br>3. LU LIU 50106174<br>4. RUIYU GONG 50106169<br>5. Han Huang 50106171<br>6. YIAYI WU 50106143<br>7. JIAYI ZHENG 50106140<br>8. RUIJIE LI 50106150<br>9. JUNYU PAN 50106130 |

Proposed project focus

A campus second-hand trading platform built around local discovery, private communication, in-person handover and transaction feedback. Later iterations will improve the same trading workflow through direct barter and convenient buyer-seller chat.

## 1 Title

Design and Implementation of Campus Neighbour

A campus second-hand trading platform

## 2 Problem

The project addresses three problems in campus second-hand trading. Fragmented information: listings and conversations are scattered across group chats and separate channels, making items difficult to find and compare. Poor transaction status visibility: buyers may not know whether an item is available, reserved or sold, while informal agreements leave handover and completion unclear. Lack of campus-specific discovery: searches need to account for campus buildings, courses and textbook editions so students can identify suitable items and arrange nearby collection. A shared campus marketplace will bring this information and the trading process together, supporting local reuse [1].

## 3 Solution

### 3.1 Core platform

We propose a responsive web application with desktop and mobile layouts for campus second-hand trading. A seller publishes an item, a buyer browses or searches, both parties communicate through private chat, they agree an in-person handover, the buyer confirms receipt on a phone, and both parties can leave feedback. The platform will support student and administrator accounts, listing moderation and notifications.

Clicking "Pay" opens a demonstration page displaying "Payment methods are currently unavailable", with a return option. No payment provider is connected, no funds are transferred and no payment success is recorded. Delivery and escrow remain outside scope.

### 3.2 Campus features and iteration

Listings will include photographs, a description, condition, price, category and campus location. Textbook listings may also include the course, author and edition. Buyers can filter by item, price, building and course. Listing status will show whether an item is available, reserved or sold. A seller can reserve an item for one buyer; cancellation releases the reservation. Reviews will be available to participants after completion. Graduation and new-semester collections can group relevant listings.

Buyer and seller profiles will provide a short introduction with fields for school or faculty, degree programme and year of study. For course-related exchanges, users can add the relevant course, its instructor and a brief description of the course. This background will help participants understand one another and discuss whether a textbook matches their course requirements.

Development will deepen this trading workflow in stages. The first release will establish publishing, filtering, chat, handover confirmation and reviews. A later iteration will add direct one-to-one barter: each user states what they offer and what they want, both accept the match, and the existing reservation and handover process is reused. Complex multi-person swaps and cash adjustments are outside scope.

We will use incremental development with short agile iterations, combining requirements, design, implementation and validation in each cycle [3]. Demonstrations and student feedback will guide the next priorities. Iterations will improve usability and reliability as well as introduce agreed trading enhancements. Versioned documentation and regular refactoring will keep the design understandable as it evolves.

### 3.3 Real-time chat and system design

The buyer-seller real-time chat window will offer four choices: Ask about price, Ask about item condition and availability, Ask about the meeting location, and Free chat. The first three choices prepare a preset question for the user to send to the other participant. Free chat allows either participant to compose a message of up to 20 characters; multiple messages may be sent. Replies come from the other participant, not an AI assistant. Preset questions and free-text messages share the same conversation history, notifications and access controls.

The proposed system consists of a browser interface, an application server and a relational database. Main records include users, buildings, courses, listings, conversations, transactions, barter preferences and reviews. Access controls will protect private messages and transaction actions. Item reservation and receipt confirmation will be recorded as controlled state changes to prevent conflicting transactions.

Quality requirements will address security, reliability, usability and maintainability [2, 5]. These include participant-only chat access, consistent reservation states, usable desktop and mobile layouts, Chinese and English interfaces, and light and dark themes. Setup instructions, a user guide and a defect log will support use and maintenance.

### 3.4 Future work

Future work may extend the platform with campus maps, elective-course reviews linked to textbooks, life guides and food information. Advanced routing, personalised recommendation, payment custody, escrow, delivery management, merchant self-service and multi-person barter are also reserved for later development. These functions are not required for the proposed proof of concept.

## 4 Objectives

O1 Requirements and design

Validate the initial problem assumptions through short interviews with student buyers and sellers and walkthroughs of existing trading practices. Review moderation needs with a representative of the administrator role. Record plain-language user stories and detailed system requirements separately, distinguishing functions from quality constraints [5]. Review the prototype and requirements for validity, consistency, completeness, feasibility and testability; link agreed requirements to use cases, design and acceptance tests.

O2 Core trading workflow

Implement accounts, listings, filters, private chat, reservation, in-person handover confirmation and transaction-based reviews.

O3 Campus enhancements

Implement buyer and seller profiles, building and course filters, seasonal collections and direct one-to-one barter. Provide preset question buttons and short free-text messages within buyer-seller real-time chat.

O4 Testing and delivery

Apply test-driven development (TDD) to new business rules and bug fixes, test the integrated workflows, resolve critical defects, and deliver reproducible software and course documentation [3].

### Evaluation approach

For TDD, write a failing test for an agreed behaviour, implement enough code to pass it, then refactor while keeping tests passing. For example, test that two buyers cannot hold an active reservation for the same item. Automated unit and integration checks will run through continuous integration; end-to-end tests will cover complete trading scenarios.

Acceptance tests will check conformance to requirements; student task sessions will check whether the platform meets users' needs [3, 5]. Checks will include filters, transaction states, chat shortcuts, the 20-character message limit, message recovery, permissions and both screen layouts. Usability and performance targets will be agreed after initial requirements and sample data are available, with test conditions recorded. Defects and feedback will inform the next iteration.

## 5 Benefits

### A practical campus trading process

Students can find nearby goods, communicate within the relevant listing and complete a transaction without logistics. Course and edition fields make textbook searches more precise, while building filters support convenient handover. Reservation and confirmation reduce uncertainty about availability, and reviews are linked to completed transactions.

### Progressive improvement within one clear scope

The project concentrates development and testing on one business process. Barter, seasonal collections and convenient real-time chat improve the same marketplace. Preset questions and short free-text messages help buyers and sellers communicate about the item and arrange a handover. This gives the team a clear minimum release while preserving room for technical and product innovation.

### Reuse and sustainability

Reselling and exchanging textbooks and everyday items can extend their useful life and reduce unnecessary disposal. Campus-based discovery and seasonal collections will help students pass usable belongings to others who need them. The project aims to make reuse convenient and support more sustainable consumption within the campus community.

## 6 Timeline

The following dates follow the course schedule. All submission deadlines are at 23:59 CST (China Standard Time, UTC+8). Supervisor allocations will be announced by 18 September; no announcement time is specified.

| Activity or deliverable | Deadline in 2026 | Weight |
| --- | --- | --- |
| Join a group on MyAberdeen | Monday, 14 September | — |
| Supervisor allocations announced | Friday, 18 September | — |
| Project proposal | Friday, 25 September | 0% |
| Project Update 1 | Monday, 12 October | 0% |
| Project Update 2 | Monday, 2 November | 0% |
| Project Update 3 | Monday, 23 November | 0% |
| Project Update 4 | Monday, 7 December | 0% |
| Technical Report | Monday, 14 December | 50% |
| Proof-of-Concept Software | Monday, 14 December | 30% |
| Presentation | Monday, 14 December | 20% |

The proposal is mandatory although unmarked; missing or late submission may result in a penalty to the overall group project mark. At least three of the four project updates are mandatory; submitting fewer may also incur a penalty. Update forms are available under Course Assessment in the Group Project folder on MyAberdeen. See the project description and submission requirements for full details.

## 7 Action plan

Internal task assignments, deadlines and progress values are to be filled by the group in line with the course dates above.

The group will track prioritised tasks, estimates, dependencies and completion evidence in GitHub Issues [4]. Weekly reviews will compare working software and test results with the plan, discuss blockers and record decisions for course updates. Integration delays and scope changes will be monitored through early integration and a prioritised backlog. Proposed changes will be assessed for user value, effort and effects on design and tests before updating the requirements and plan [5].

### Objective O1 Requirements and design

| Action | Assigned to | Deadline | Progress |
| --- | --- | --- | --- |
| Interview users, review trading practices and prioritise requirements. | [To be filled] | [To be filled] | [To be filled] |
| Review use cases, prototype, architecture, data model and acceptance criteria. | [To be filled] | [To be filled] | [To be filled] |

### Objective O2 Core trading workflow

| Action | Assigned to | Deadline | Progress |
| --- | --- | --- | --- |
| Build accounts, listings, filters and private chat. | [To be filled] | [To be filled] | [To be filled] |
| Build reservation, handover confirmation and reviews. | [To be filled] | [To be filled] | [To be filled] |

### Objective O3 Campus enhancements

| Action | Assigned to | Deadline | Progress |
| --- | --- | --- | --- |
| Add user profiles, campus-specific fields, seasonal collections and direct barter. | [To be filled] | [To be filled] | [To be filled] |
| Implement and test preset question buttons and short free-text messages in buyer-seller chat. | [To be filled] | [To be filled] | [To be filled] |

### Objective O4 Testing and delivery

| Action | Assigned to | Deadline | Progress |
| --- | --- | --- | --- |
| Use TDD and automated checks for permissions, trading states, search and concurrency. | [To be filled] | [To be filled] | [To be filled] |
| Run student tasks, resolve defects and repeat affected tests. | [To be filled] | [To be filled] | [To be filled] |
| Prepare the release, report, manual and presentation. | [To be filled] | [To be filled] | [To be filled] |

## References

[1] Ministry of Commerce and eight other departments (2026). Notice on Implementing the Green Consumption Promotion Action. 4 January. Sections 9 and 12. [Official policy text](https://www.mofcom.gov.cn/gztz/art/2026/art_bc2dca6b29f144dbb1583d74af2bcfc4.html)

Source accessed 15 September 2026. The English title is a descriptive translation of the Chinese original.

[2] JC2001 (2026–27). Lecture 1: Introduction & Course Overview. Course slides, Week 1, Day 1.

[3] JC2001 (2026–27). Lecture 2: Software Processes & Agile Software Development. Course slides, Week 2, Day 1.

[4] JC2001 (2026–27). Lecture 3: Project Management. Course slides, Week 2, Day 2.

[5] JC2001 (2026–27). Lecture 5: Requirements Engineering. Course slides, Week 4, Day 1.
