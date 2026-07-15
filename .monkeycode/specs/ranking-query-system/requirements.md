# 排行榜查询系统 - 需求文档

## Introduction

本系统在现有打卡签到系统（yldk）的技术框架基础上，构建一个面向排名的查询系统。系统以"分组 × 时段"构成全量打卡位，人员覆盖所有打卡位，汇总分值形成全局排名。

本需求文档使用 EARS (Easy Approach to Requirements Syntax) 模式编写，遵循 INCOSE 语义质量规则。

## Glossary

- **分组 (Group)**：一个逻辑分类维度，包含若干时段，如"A组"、"B组"。分组配置示例：`分组A-08:00-11:00,11:00-14:00,20:00-23:00` 表示 A组包含三个时段。
- **时段 (Time Slot)**：隶属于某个分组的时间段，格式为 `HH:MM-HH:MM`，如"08:00-11:00"。一个分组可包含多个时段，时段之间用逗号分隔。
- **打卡位 (Slot)**：一个"分组-时段"组合，即一个独立的记分单元，在导出和矩阵视图中以"分组名-时段名"格式呈现，如"A组-08:00-11:00"。
- **全量打卡位 (Full Slot Set)**：所有分组 x 所有时段组成的完整集合。
- **记录 (Record)**：单次数据条目，包含姓名、分组、时段、分值、日期。
- **分组得分 (Group Score)**：个人在某分组下有时段数据记录的个数。每个打卡位有数据计 1 分，无数据计 0 分。如 A组有 3 个时段，2 个有时段有数据则为 2 分。
- **总分 (Total Score)**：个人所有分组得分的总和。
- **排名 (Ranking)**：按总分降序排列的全局名次。

## Requirements

### R1 - 排行榜首页

**User Story:** 作为任意用户，我希望在首页看到全员总分排名，并能搜索特定人员的排名，以便快速了解排名情况。

#### Acceptance Criteria

1. The system SHALL display a ranked list of all persons ordered by total score descending on the homepage.
2. The system SHALL display each ranking entry containing: rank number, person name, per-group scores (one column per group), and total score.
3. The system SHALL calculate each group score as the count of time slots within that group for which the person has a data record.
4. The system SHALL provide a search input that filters the ranking list by person name in real time.
5. WHEN a user searches a name, the system SHALL highlight the matched entry and preserve the ranking number context.
6. The homepage SHALL be publicly accessible without authentication.
7. The system SHALL display a navigation bar linking to dashboard, records, export, and admin pages.

---

### R2 - 分组管理

**User Story:** 作为管理员，我希望管理分组及其时段配置，以便灵活调整全量打卡位的组成结构。

#### Acceptance Criteria

1. The system SHALL allow administrators to create, rename, delete, and reorder groups.
2. WHEN an administrator deletes a group, the system SHALL remove all time slots belonging to that group and all associated records.
3. WHEN an administrator deletes a group, the system SHALL prompt confirmation before execution.
4. The system SHALL allow administrators to add, edit, and delete time slots within each group.
5. Each time slot SHALL contain a name label and a time range (start time and end time in HH:MM format).
6. The system SHALL update the full slot set and recalculate all rankings after any group or time slot modification.
7. The system SHALL require administrator authentication to access group management.

---

### R3 - 系统设置

**User Story:** 作为管理员，我希望管理系统的基础配置和公告信息。

#### Acceptance Criteria

1. The system SHALL provide administrator login via username and SHA-256 hashed password.
2. The system SHALL allow administrators to publish and deactivate announcements displayed on the homepage.
3. The system SHALL store announcements with content, active status, and timestamps.

---

### R4 - 数据看板

**User Story:** 作为管理员或查看者，我希望看到数据的统计概览。

#### Acceptance Criteria

1. The system SHALL display total person count and total record count.
2. The system SHALL display score distribution across persons.
3. The system SHALL display per-group average score comparison.
4. The system SHALL display the number of missing slots per person.
5. The system SHALL display top-N ranking persons.

---

### R5 - 历史记录

**User Story:** 作为管理员，我希望按多维度筛选查看所有数据记录，并能按分组-时段结构查看每个打卡位的数据有无。

#### Acceptance Criteria

1. The system SHALL list all records with person name, group, time slot, score, date, and import timestamp.
2. The system SHALL provide a cross-table view organized by group, showing per-slot record status for each person.
3. The system SHALL provide filters by date range, person name, group, and time slot.
4. The system SHALL allow administrators to manually add a single record.
5. The system SHALL allow administrators to edit an existing record's score value.
6. The system SHALL allow administrators to delete a single record.
7. WHEN a record is added, edited, or deleted, the system SHALL recalculate the affected person's total score and ranking.

---

### R6 - 数据导入

**User Story:** 作为管理员，我希望通过 Excel 导入批量录入数据，并支持手动补充录入。

#### Acceptance Criteria

1. The system SHALL provide an Excel import function that intelligently detects the data layout from uploaded files, supporting both list format (rows as records) and matrix format (rows as persons, columns as group-slot pairs).
2. The system SHALL accept a single numeric score value per record.
3. WHEN an Excel file is imported, the system SHALL validate that each row references existing groups and time slots.
4. IF a row references a non-existent group or time slot, the system SHALL reject that row and report the error with row number.
5. The system SHALL support appending new data without overwriting existing records during import.
6. The system SHALL allow administrators to manually input a single record via a form with fields: person name, group, time slot, score, and date.
7. WHEN data is imported or manually added, the system SHALL recalculate total scores and rankings for affected persons.

---

### R7 - 数据导出

**User Story:** 作为管理员，我希望将排名数据和记录明细导出为 Excel 文件。

#### Acceptance Criteria

1. The system SHALL export the full ranking list with columns: rank, person name, one column per group (using group name as header), and total score.
2. The system SHALL calculate each group column value as the count of time slots within that group for which the person has a data record (each slot with data contributes 1 point).
3. The system SHALL calculate total score as the sum of all group column values.
4. The system SHALL export all records detail with columns: person name, group name, time slot, score, date, import time to an Excel file.
5. The system SHALL apply date range and person name filters to the record detail export.

---

### R8 - 排名计算规则

**User Story:** 作为系统，我需要保证排名计算逻辑的正确性和一致性。

#### Acceptance Criteria

1. The system SHALL count each data record in a slot as contributing 1 point toward the person's group score, regardless of the record's score value.
2. The system SHALL calculate each person's group score as the count of time slots within that group for which the person has at least one data record.
3. The system SHALL calculate total score as the sum of all group scores.
4. The system SHALL treat a missing slot for a person as a score of zero in total calculation.
5. The system SHALL define the full slot set as the Cartesian product of all active groups and their respective active time slots.
6. The system SHALL rank persons by total score in descending order.
7. WHEN two or more persons have equal total scores, the system SHALL assign them the same rank number and skip subsequent rank numbers accordingly.
8. WHEN a group or time slot is added, the system SHALL update the full slot set and treat new slots as zero for persons without records in that slot.
9. WHEN a group or time slot is removed, the system SHALL exclude that slot from the full slot set and recalculate all group scores and total scores.

---

## 与原系统的关系

本系统复用原 yldk 打卡系统的技术基础设施：
- Cloudflare Pages + D1 数据库
- SHA-256 哈希认证机制
- 北京时区处理工具函数
- xlsx 库（Excel 导入导出）
- Sentry 前端错误监控
- 页面导航结构和 CSS 样式体系

本系统独立运行，使用独立的数据库，不依赖于原打卡系统的数据。
