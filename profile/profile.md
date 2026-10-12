# Alex Novak — professional profile

> Fictional example profile. Replace this folder with your own CV to run the assistant for yourself.

This is the only source of facts the assistant may use. Every section starts with an id in square brackets; answers cite these ids. Keep it to what you are happy to publish: details of employers' internal systems, clients and metrics stay out.

## [basics] Summary
- Senior Backend Engineer at Ledgerline, a payments platform for online marketplaces, based in Kraków, Poland. Open to remote work.
- 8 years of professional experience, all in backend engineering for payments and logistics products.
- Focus areas: payment processing, event-driven systems, PostgreSQL performance, developer experience.
- Pronouns: she/her.

## [ledgerline.roles] Roles at Ledgerline (Kraków, Poland)
- Senior Backend Engineer — March 2023 to present.
- Backend Engineer — June 2021 to February 2023.
- Each move was a promotion within Ledgerline (promoted to senior in March 2023).

## [ledgerline.payouts] Marketplace payouts
- Leads the backend of the payouts service that sends sellers their earnings, written in Go with PostgreSQL and Kafka.
- Redesigned payout batching around an outbox pattern and idempotency keys, which removed duplicate payouts after retries.
- Owns the service end to end: design reviews, on-call rotation, runbooks and release planning.

## [ledgerline.reconciliation] Reconciliation pipeline
- Built a daily reconciliation pipeline that matches bank statements with internal ledger entries, in Python with pandas and Airflow.
- Cut the time finance needs for month-end close from four days to one.

## [ledgerline.platform] Platform and developer experience
- Moved the team's services from virtual machines to Kubernetes (Amazon EKS) with Helm charts and Argo CD.
- Introduced OpenTelemetry tracing across six services and the first SLOs for the payouts API.
- Mentors two mid-level engineers and runs the backend interview loop for her team.

## [parcelo] Backend Engineer at Parcelo (2018–2021)
- Parcelo is a parcel-locker logistics startup in Wrocław, Poland. Alex joined as its fourth engineer.
- Built the courier routing API in Node.js and TypeScript on AWS Lambda and DynamoDB.
- Integrated three national carriers through their REST and SOAP APIs, with retries and dead-letter queues on Amazon SQS.

## [side-projects] Side projects
- Maintains an open-source PostgreSQL migration linter for Go projects (about 400 GitHub stars).
- Gave a talk on idempotent payment APIs at a Kraków Go meetup in 2024.

## [skills] Skills
- Languages: Go (expert), Python, TypeScript, SQL.
- Data: PostgreSQL, Kafka, Redis, DynamoDB, Airflow.
- Cloud and infrastructure: AWS (EKS, Lambda, SQS, RDS), Kubernetes, Helm, Argo CD, Terraform.
- Practices: event-driven architecture, outbox pattern, idempotency, observability with OpenTelemetry, SLOs, on-call.

## [education] Education
- MSc in Computer Science, AGH University of Kraków, 2018.

## [languages] Languages
- Polish (native), English (C1, professional working proficiency).
