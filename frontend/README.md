# GitViz – Frontend

A production-ready frontend built with **Next.js**, **TypeScript**, **TailwindCSS**, and **ShadCN UI**. This app visualizes repository structures and content by interacting with backend APIs.

---

## 📦 Tech Stack

- **Next.js** (App Router + TypeScript)
- **TailwindCSS** (utility-first styling)
- **ShadCN/UI** (component library)
- **OpenAPI SDK** (`api-client/` auto-generated)
- **PNPM** (package manager)

---

## 🚀 Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/gitviz.git
cd gitviz
```

### 2. Install Dependencies

Using **pnpm** (preferred):

```bash
pnpm install
```

Or, if using npm:

```bash
npm install
```

### 3. Setup Environment Variables

Create a `.env.local` file by copying the example:

```bash
cp .env.example .env.local
```

Update the variables in `.env.local` as needed (e.g. API base URL).

### 4. Run Development Server

```bash
pnpm dev
```

This runs the app in development mode.
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

### 5. Build for Production

```bash
pnpm build
pnpm start
```

- `build` generates the production-optimized files
- `start` runs the production server

### 6. Lint the Code

```bash
pnpm lint
```

---

## ⚙️ Scripts

| Script | Description |
|--------|-------------|
| `dev` | Run dev server with Turbopack |
| `build` | Create production build |
| `start` | Start production server |
| `lint` | Run ESLint |
| `generate:api` | Regenerate SDK from OpenAPI spec |
| `setup:env` | Copy .env.example to .env.local |

---

## 📁 Project Structure

```
.
├── api-client/           # Auto-generated OpenAPI SDK files
├── app/                  # Next.js App Router pages
├── components/           # Reusable UI components
├── context/              # React context providers
├── lib/                  # Utility functions
├── public/               # Static assets (images, icons)
├── utils/                # API helpers & models
├── styles/               # Global styles (e.g., Tailwind)
├── .env.example          # Sample environment variables
├── next.config.ts        # Next.js configuration
├── openapi-ts.config.ts  # OpenAPI SDK generation config
```