
# Feedback System Database Design (Dry Cleaners Application)

## Overview

This feedback system is designed for a dry-cleaning application where the questions shown to customers depend on their age group.

### Flow

1. Customer enters basic details:
   - Name
   - Phone Number
   - Email
   - Age

2. The backend determines the customer's age group.

3. Questions associated with that age group are fetched.

4. The customer submits feedback.

5. Answers are stored in the database.

---

# Database Tables

## 1. customers

Stores customer information.

```sql
CREATE TABLE customers (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,

    name VARCHAR(100) NOT NULL,
    phone VARCHAR(15) NOT NULL UNIQUE,
    email VARCHAR(150),
    age INT NOT NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP
);
```

### Model

| Column | Type | Description |
|----------|--------|--------|
| id | BIGINT | Primary key |
| name | VARCHAR(100) | Customer name |
| phone | VARCHAR(15) | Unique phone number |
| email | VARCHAR(150) | Customer email |
| age | INT | Customer age |
| created_at | TIMESTAMP | Creation timestamp |
| updated_at | TIMESTAMP | Last update timestamp |

---

## 2. age_groups

Defines age ranges.

```sql
CREATE TABLE age_groups (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,

    name VARCHAR(50) NOT NULL,

    min_age INT NOT NULL,
    max_age INT NOT NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Seed Data

```sql
INSERT INTO age_groups (name, min_age, max_age)
VALUES
('Kids', 0, 12),
('Teenagers', 13, 18),
('Adults', 19, 45),
('Senior Citizens', 46, 120);
```

### Model

| Column | Type | Description |
|----------|--------|--------|
| id | BIGINT | Primary key |
| name | VARCHAR(50) | Group name |
| min_age | INT | Minimum age |
| max_age | INT | Maximum age |
| created_at | TIMESTAMP | Creation timestamp |

---

## 3. questions

Stores all feedback questions.

```sql
CREATE TABLE questions (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,

    question TEXT NOT NULL,

    question_type ENUM(
        'text',
        'textarea',
        'radio',
        'checkbox',
        'rating',
        'dropdown'
    ) NOT NULL,

    is_required BOOLEAN DEFAULT FALSE,

    sort_order INT DEFAULT 0,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP
);
```

### Model

| Column | Type | Description |
|----------|--------|--------|
| id | BIGINT | Primary key |
| question | TEXT | Question text |
| question_type | ENUM | Input type |
| is_required | BOOLEAN | Mandatory field |
| sort_order | INT | Display order |
| created_at | TIMESTAMP | Creation timestamp |
| updated_at | TIMESTAMP | Update timestamp |

---

## 4. question_age_groups

Maps questions to age groups.

```sql
CREATE TABLE question_age_groups (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,

    question_id BIGINT NOT NULL,
    age_group_id BIGINT NOT NULL,

    FOREIGN KEY (question_id)
        REFERENCES questions(id),

    FOREIGN KEY (age_group_id)
        REFERENCES age_groups(id)
);
```

### Model

| Column | Type | Description |
|----------|--------|--------|
| id | BIGINT | Primary key |
| question_id | BIGINT | Reference to question |
| age_group_id | BIGINT | Reference to age group |

---

## 5. question_options

Stores options for radio buttons, checkboxes, and dropdowns.

```sql
CREATE TABLE question_options (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,

    question_id BIGINT NOT NULL,

    option_text VARCHAR(255) NOT NULL,

    sort_order INT DEFAULT 0,

    FOREIGN KEY (question_id)
        REFERENCES questions(id)
);
```

### Model

| Column | Type | Description |
|----------|--------|--------|
| id | BIGINT | Primary key |
| question_id | BIGINT | Reference to question |
| option_text | VARCHAR(255) | Option label |
| sort_order | INT | Display order |

---

## 6. feedback_submissions

Represents one feedback submission by a customer.

```sql
CREATE TABLE feedback_submissions (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,

    customer_id BIGINT NOT NULL,

    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (customer_id)
        REFERENCES customers(id)
);
```

### Model

| Column | Type | Description |
|----------|--------|--------|
| id | BIGINT | Primary key |
| customer_id | BIGINT | Customer reference |
| submitted_at | TIMESTAMP | Submission time |

---

## 7. feedback_answers

Stores customer responses.

```sql
CREATE TABLE feedback_answers (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,

    submission_id BIGINT NOT NULL,

    question_id BIGINT NOT NULL,

    answer_text TEXT,

    option_id BIGINT,

    rating INT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (submission_id)
        REFERENCES feedback_submissions(id),

    FOREIGN KEY (question_id)
        REFERENCES questions(id),

    FOREIGN KEY (option_id)
        REFERENCES question_options(id)
);
```

### Model

| Column | Type | Description |
|----------|--------|--------|
| id | BIGINT | Primary key |
| submission_id | BIGINT | Feedback submission |
| question_id | BIGINT | Question reference |
| answer_text | TEXT | Text answer |
| option_id | BIGINT | Selected option |
| rating | INT | Rating value |
| created_at | TIMESTAMP | Creation timestamp |

---

# Example Questions by Age Group

## Kids (0–12)

- Were your child's uniforms cleaned properly?
- Were stains removed effectively?
- Was pickup convenient?

## Teenagers (13–18)

- Are you satisfied with our express service?
- Do you prefer app notifications?
- Would you recommend us to friends?

## Adults (19–45)

- How often do you use our dry-cleaning services?
- Was delivery on time?
- Was the pricing reasonable?
- Which service do you use most?

## Senior Citizens (46+)

- Was the app easy to use?
- Was pickup staff polite?
- Would you prefer support over phone calls?

---

# Future Improvements

Instead of showing questions only based on age, the system can later support:

- Customer type
- Premium membership
- Order count
- City
- Total spending
- Order history

This approach will make the feedback engine scalable and easier to maintain.
