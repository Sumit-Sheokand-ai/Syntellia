# Privacy Intelligence Tools

Six powerful HIBP-style utility websites to check how your personal information is being used in AI training, telemarketing, housing records, and more. All tools use **free, public APIs**—no paid or proprietary dependencies.

## 🚀 Features

### 1. 🤖 AI Content Training Check
Check if your content or URL has been crawled and used in AI training datasets.
- **Data Sources**: Common Crawl CDX API, infini-gram API
- **Datasets Covered**: Dolma (3T tokens), RedPajama (1.4T), The Pile (380B), C4 (200B)
- **Use Case**: Verify if your blog posts, articles, or website content was used to train LLMs

### 2. 📞 Robocall Spoofing Check
Find out if your phone number has been spoofed by robocallers.
- **Data Source**: FCC Consumer Complaints Open Data API
- **Coverage**: All reported US complaints
- **Use Case**: See if scammers are using your number as caller ID

### 3. 💊 Medication Formula Check
Track FDA-approved medication formula changes over time.
- **Data Source**: openFDA Drug Label API
- **Coverage**: All FDA-approved medications
- **Use Case**: Detect if inactive ingredients changed between refills

### 4. 💼 Job AI Screening Check
Detect if a company uses AI-powered applicant tracking systems (ATS).
- **Detection Methods**: URL pattern matching, page content analysis
- **ATS Vendors Detected**: Greenhouse, Lever, Workday, iCIMS, Taleo, and more
- **Use Case**: Optimize your resume for AI screening

### 5. 🏠 Landlord Court Record Check
Search NYC housing court records for violations and litigation.
- **Data Source**: NYC HPD Open Data (Socrata API)
- **Coverage**: NYC (Chicago, Boston planned)
- **Use Case**: Check landlord history before signing a lease

### 6. 📸 Face Dataset Check
Check if your photo appears in AI training datasets like LAION-5B.
- **Methods**: URL matching, CLIP visual similarity
- **Datasets**: LAION-5B, LAION-400M
- **Use Case**: Find out if your photos were used to train image AI models

## 🛠️ Tech Stack

- **Backend**: ASP.NET Core 10
- **Frontend**: React 19 + TypeScript + Vite
- **Authentication**: Supabase Auth (email, Google, GitHub OAuth)
- **Styling**: Custom CSS with HIBP-inspired design
- **Routing**: React Router
- **APIs**: All free, public APIs (no API keys required for basic use)

## ✨ New: User Authentication

The application now includes **Supabase authentication** with the following features:

- 📧 **Email/Password Sign Up & Login**
- 🔐 **OAuth Integration** (Google, GitHub)
- 👤 **User Profiles**
- 💾 **Save Searches** (Coming Soon)
- 📊 **Search History** (Coming Soon)
- 🔔 **Email Alerts** (Coming Soon)

**See [SUPABASE_SETUP.md](SUPABASE_SETUP.md) for setup instructions.**

### 🔐 Auth Configuration (No `.env` Files)

This project is configured to use environment variables or GitHub Secrets only.

- Required frontend variables:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
- For local development: set them as shell/system environment variables.
- For GitHub Actions: add the same names in repo secrets.

## 📋 Prerequisites

- .NET 10 SDK
- Node.js 18+ and npm

## 🚀 Getting Started

### 1. Clone the repository
```bash
git clone <your-repo-url>
cd tools_website
```

### 2. Install frontend dependencies
```bash
cd tools_website.client
npm install
```

### 3. Run the application
```bash
# From the root directory
dotnet run --project tools_website.Server
```

The application will be available at `https://localhost:5173` (frontend) and `https://localhost:7xxx` (backend API).

### 4. Development Mode
For hot-reload development:
```bash
# Terminal 1: Run backend
cd tools_website.Server
dotnet run

# Terminal 2: Run frontend
cd tools_website.client
npm run dev
```

## 📁 Project Structure

```
tools_website/
├── tools_website.Server/
│   ├── Controllers/
│   │   ├── AIContentCheckController.cs
│   │   ├── RobocallCheckController.cs
│   │   ├── MedicationCheckController.cs
│   │   ├── JobScreeningCheckController.cs
│   │   ├── LandlordCheckController.cs
│   │   └── FaceDatasetCheckController.cs
│   └── Program.cs
└── tools_website.client/
    ├── src/
    │   ├── pages/
    │   │   ├── Home.tsx
    │   │   ├── AIContentCheck.tsx
    │   │   ├── RobocallCheck.tsx
    │   │   ├── MedicationCheck.tsx
    │   │   ├── JobScreeningCheck.tsx
    │   │   ├── LandlordCheck.tsx
    │   │   └── FaceDatasetCheck.tsx
    │   ├── App.tsx
    │   ├── App.css
    │   └── index.css
    └── package.json
```

## 🔍 API Endpoints

### AI Content Check
- `POST /api/AIContentCheck/check-url` - Check URL in Common Crawl
- `POST /api/AIContentCheck/check-text` - Check text in training datasets

### Robocall Check
- `GET /api/RobocallCheck/check/{phoneNumber}` - Check FCC complaints

### Medication Check
- `GET /api/MedicationCheck/check?drugName={name}&manufacturer={optional}` - Check FDA labels

### Job Screening Check
- `POST /api/JobScreeningCheck/check` - Detect ATS system

### Landlord Check
- `GET /api/LandlordCheck/check?query={name}&city={nyc}` - Check housing records

### Face Dataset Check
- `POST /api/FaceDatasetCheck/check-url` - Check image URL
- `POST /api/FaceDatasetCheck/check-upload` - Check uploaded image

## 🎨 Design Philosophy

The UI follows the HIBP (Have I Been Pwned) style:
- **Dark theme** with high contrast
- **Single-purpose tools** with focused functionality
- **Clear verdicts** (found/not found)
- **Transparent limitations** - honest about data coverage
- **No account required** - instant results

## ⚠️ Limitations & Disclaimers

1. **Common Crawl**: Only checks ~80 named crawls from 2013-2024
2. **Infini-gram**: Exact n-gram matching; requires clean prose
3. **FCC Complaints**: Only US data; depends on user reports
4. **openFDA**: Weekly updates; generic/OTC drugs may have limited data
5. **ATS Detection**: Cannot confirm if AI scoring is actually enabled
6. **NYC HPD**: Geographic limitation; other cities have separate databases
7. **LAION Check**: Probabilistic; full 5B-vector kNN not feasible for static hosting

## 📝 Data Sources

All data sources are free and publicly accessible:
- [Common Crawl Index](https://index.commoncrawl.org/)
- [Infini-gram API](https://api.infini-gram.io/)
- [FCC Consumer Complaints](https://opendata.fcc.gov/)
- [openFDA Drug Labels](https://api.fda.gov/)
- [NYC Open Data](https://data.cityofnewyork.us/)
- [LAION Datasets](https://laion.ai/)

## 🤝 Contributing

Contributions are welcome! Areas for improvement:
- Add more city coverage for landlord checks
- Improve ATS vendor detection
- Add CLIP embedding generation for face dataset check
- Expand to additional datasets (CommonCrawl, ImageNet, etc.)

## 📄 License

This project is open source and available under the MIT License.

## 🙏 Acknowledgments

- Inspired by [Have I Been Pwned](https://haveibeenpwned.com/)
- Data provided by Common Crawl, FCC, FDA, NYC Open Data, and LAION
- Built with ASP.NET Core and React

---

**Note**: This tool is for educational and transparency purposes. Always verify critical information through official sources.
