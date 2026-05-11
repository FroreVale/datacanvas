# Full-Stack Engineer Take-Home Assignment

**Estimated Time:** 6-10 hours  
**Focus:** Product Engineering, React, TypeScript, Node.js

## 🎯 The Challenge

Build a **Data Query & Visualization Platform** - a mini version of what we do at DataBrain.

Users should be able to:
1. Connect to a data source
2. Write queries to transform/aggregate data
3. Build visualizations from query results
4. Share dashboards with different access levels

### The Scenario

You're building for a B2B SaaS company that wants to let their customers create custom analytics dashboards. Each customer has multiple users with different permissions (admin, editor, viewer).

---

## 📋 Core Requirements

Your solution must handle:

### 1. Data Layer
- Support at least one data source (CSV upload, SQLite file, or mock API)
- Allow users to **query/transform** data (aggregations, filters, grouping)
- Handle datasets with 1000+ rows efficiently

### 2. Query Builder
Users need to be able to:
- Select dimensions and metrics
- Apply aggregations (SUM, AVG, COUNT, etc.)
- Add filters (WHERE conditions)
- Preview query results before creating charts

Think: How would a non-technical user build a query without writing SQL?

### 3. Visualization Engine
- Support 3+ chart types (your choice which ones make sense)
- Charts should update when underlying data/query changes
- Handle edge cases (empty data, null values, etc.)

### 4. Multi-User Access Control
Implement a simple permission system:
- **Admins:** Can create/edit/delete everything
- **Editors:** Can create/edit their own charts
- **Viewers:** Read-only access

You don't need authentication - just simulate different user roles.

### 5. Performance & Scale
Your solution should handle:
- Multiple concurrent users viewing different dashboards
- Datasets with 1000+ rows without blocking the UI
- Efficient query execution and caching

### 6. State Management & Data Flow
You'll need to think through:
- How do charts stay in sync when data changes?
- How do you handle optimistic updates?
- What happens when two editors modify the same chart?
- How do you structure your state for scalability?

---

## 🎨 Product Thinking Questions

We want to see how you think about **real-world product scenarios**:

1. **How do you balance flexibility vs simplicity?** Power users want control, but beginners need guidance.

2. **What happens when data changes?** If someone uploads a new CSV, what happens to existing charts?

3. **Performance tradeoffs:** Would you compute aggregations on the frontend or backend? Why?

4. **Error recovery:** A user creates a chart, then deletes the underlying data source. Now what?

5. **Collaborative editing:** Two editors modify the same dashboard. How do you prevent conflicts?

**You don't need to solve all of these, but address the ones you think matter most in your README.**

---

## 🛠 Technical Constraints

### You MUST use:
- **Frontend:** React + TypeScript
- **Backend:** Node.js + TypeScript
- **Modern practices:** Functional components, hooks, proper typing

### Everything else is up to you:
- Architecture patterns
- State management approach
- UI framework/styling
- Chart library
- Data storage strategy
- API design
- Testing approach

**We want to see YOUR architectural decisions, not follow a recipe.**

---

## 📦 Deliverables

Submit a **GitHub repository** with:

1. **Working Application**
   - Source code with clear structure
   - Runs locally without issues

2. **README.md** that tells us:
   - Architecture & design decisions (this is critical)
   - Tradeoffs you made and why
   - How you approached the hardest problems
   - What you'd do differently with more time
   - Rough time breakdown

3. **Design Document** (can be part of README)
   - API design & data models
   - State management approach
   - Permission system design
   - Performance optimizations

We care MORE about your thinking than perfect execution.

---

## 🎯 What We're Evaluating

### 1. **Problem-Solving & Architecture (35%)**
- How did you break down the problem?
- Are your architectural decisions well-reasoned?
- Did you identify the hard parts and tackle them?
- How do you handle complexity and tradeoffs?

### 2. **Code Craftsmanship (30%)**
- TypeScript: Proper types, not just `any` everywhere
- React: Clean components, appropriate hooks, performance awareness
- Backend: Sensible API design, error handling, data validation
- Overall: Readable, maintainable, well-structured

### 3. **Product Sense (20%)**
- Does the UX make sense for the target user?
- Did you think through edge cases and failure modes?
- How do you prioritize features vs time?
- Is there evidence of user empathy?

### 4. **Communication & Judgment (15%)**
- README explains the "why" not just the "what"
- You acknowledge limitations and tradeoffs
- Git history shows your thought process
- You know what NOT to build (scope management)

---

## 💡 What We're Looking For

We're hiring for **curious self-starters with agency**. Show us:

- **Agency:** You made decisions and ran with them
- **Critical Thinking:** You identified ambiguities and made reasonable choices
- **Pragmatism:** You shipped something useful in limited time
- **Depth:** You went deep on hard problems, not broad on easy ones
- **Self-awareness:** You know what you don't know

**Red Flags:**
- Waiting for perfect requirements instead of making reasonable assumptions
- Building everything but nothing works well
- No evidence of thinking about real-world constraints
- Copy-pasting code you don't understand

---

## 🚀 Approach This Like a Real Project

This is intentionally open-ended. Here's how to succeed:

1. **Make Assumptions** - Document them in your README
2. **Prioritize Ruthlessly** - 10 hours isn't much time
3. **Solve Hard Problems** - Show us how you think through complexity
4. **Ship Working Software** - We want to run it and see it work
5. **Explain Your Thinking** - The README is as important as the code

**You'll have choices to make:**
- Which data source to support?
- How complex should the query builder be?
- Client-side or server-side aggregations?
- Synchronous or optimistic updates?
- How much to test vs ship?

**There are no right answers - only well-reasoned decisions.**

---

## ❓ FAQs

**Q: Can I use create-react-app / Vite?**  
A: Absolutely! Use any tooling you're comfortable with.

**Q: What if I can't finish everything in 8 hours?**  
A: That's okay! Document what you'd do next in your README.

**Q: Can I use AI tools (ChatGPT, Copilot)?**  
A: Yes, but be prepared to explain your code in a follow-up discussion.

**Q: Should I deploy this?**  
A: No need. Clear local setup instructions are sufficient.

**Q: Can I add extra features?**  
A: Yes, but nail the basics first. Show us you can prioritize.

---

## 📬 Submission

Email your GitHub repository link to [hiring email] within **72 hours** of receiving this assignment.

**Timeline:**
- Receive assignment: Day 1
- Submit by: Day 3, 11:59 PM
- Follow-up discussion: Day 5-7

---

## 🌟 Bonus Challenges (Optional)

If you finish early and want to impress:

1. **Data Filters** - Add ability to filter data before charting
2. **Chart Export** - Export charts as PNG/PDF
3. **Multiple Datasets** - Support multiple CSV uploads in one dashboard
4. **Undo/Redo** - Implement undo/redo for chart operations
5. **Keyboard Shortcuts** - Add power-user features
6. **Dark Mode** - Theme switching

Remember: **Quality over quantity**. A polished core experience beats half-finished bonus features.

---

## 📝 Example Use Case

To help you understand the flow:

1. User uploads `sales_data.csv` with columns: `date`, `product`, `revenue`, `quantity`
2. User creates a Bar Chart with X=`product`, Y=`revenue`, Title="Revenue by Product"
3. Chart appears in dashboard
4. User creates another chart: Line Chart with X=`date`, Y=`revenue`
5. Both charts display side-by-side
6. User can delete charts or upload new data

---

**Good luck! We're excited to see what you build. 🚀**

Remember: We're not looking for perfection. We want to see how you think, how you prioritize, and how you build products. Have fun with it!

