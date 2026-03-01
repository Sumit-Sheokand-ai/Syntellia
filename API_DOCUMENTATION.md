# API Documentation

Complete reference for all backend API endpoints.

## Base URL
- **Local Development**: `https://localhost:7xxx/api`
- **Production**: `https://your-domain.com/api`

---

## 🤖 AI Content Check API

### Check URL in Common Crawl
**Endpoint**: `POST /api/AIContentCheck/check-url`

**Request Body**:
```json
{
  "Url": "https://example.com"
}
```

**Response** (200 OK):
```json
{
  "Found": true,
  "TotalRecords": 45,
  "Crawls": [
    {
      "Crawl": "CC-MAIN-2024-10",
      "Count": 12
    }
  ],
  "SampleRecords": [
    {
      "Crawl": "CC-MAIN-2024-10",
      "Timestamp": "20240301120000",
      "Url": "https://example.com",
      "Status": "200"
    }
  ]
}
```

### Check Text in Training Datasets
**Endpoint**: `POST /api/AIContentCheck/check-text`

**Request Body**:
```json
{
  "Text": "Your text content to check..."
}
```

**Response** (200 OK):
```json
{
  "Found": true,
  "Results": [
    {
      "IndexName": "Dolma (3T tokens)",
      "Count": 127,
      "Found": true
    }
  ],
  "TextSnippet": "Your text content to check..."
}
```

---

## 📞 Robocall Check API

### Check Phone Number
**Endpoint**: `GET /api/RobocallCheck/check/{phoneNumber}`

**Parameters**:
- `phoneNumber` (path): Phone number in any format

**Example**: `/api/RobocallCheck/check/5551234567`

**Response** (200 OK):
```json
{
  "PhoneNumber": "5551234567",
  "TotalComplaints": 23,
  "Spoofed": true,
  "ComplaintTypes": [
    {
      "Type": "Robocall",
      "Count": 15
    },
    {
      "Type": "Live voice",
      "Count": 8
    }
  ],
  "StateDistribution": [
    {
      "State": "CA",
      "Count": 10
    }
  ],
  "RecentComplaints": [
    {
      "Date": "2024-01-15",
      "Type": "Robocall",
      "State": "CA",
      "Subject": "Unwanted call"
    }
  ]
}
```

**Error Response** (400 Bad Request):
```json
{
  "Error": "Invalid phone number format"
}
```

---

## 💊 Medication Check API

### Check Medication Formula
**Endpoint**: `GET /api/MedicationCheck/check`

**Query Parameters**:
- `drugName` (required): Brand name of the drug
- `manufacturer` (optional): Manufacturer name

**Example**: `/api/MedicationCheck/check?drugName=Tylenol&manufacturer=Johnson%20%26%20Johnson`

**Response** (200 OK):
```json
{
  "Found": true,
  "DrugName": "Tylenol",
  "TotalLabels": 5,
  "HasFormulaChanges": true,
  "Changes": [
    {
      "FromDate": "20200101",
      "ToDate": "20230615",
      "Changed": true,
      "Summary": "Inactive ingredients changed"
    }
  ],
  "CurrentLabel": {
    "EffectiveDate": "20230615",
    "Manufacturer": "Johnson & Johnson",
    "InactiveIngredients": "cellulose, starch, ..."
  },
  "HistoricalLabels": [
    {
      "EffectiveDate": "20230615",
      "Manufacturer": "Johnson & Johnson"
    }
  ]
}
```

**Not Found Response** (200 OK):
```json
{
  "Found": false,
  "Message": "No FDA records found for this medication"
}
```

---

## 💼 Job Screening Check API

### Check Company ATS
**Endpoint**: `POST /api/JobScreeningCheck/check`

**Request Body**:
```json
{
  "CompanyName": "Google",
  "CareersUrl": "https://careers.google.com"
}
```

**Response** (200 OK):
```json
{
  "CompanyName": "Google",
  "CareersUrl": "https://careers.google.com",
  "ATSDetected": true,
  "ATSVendor": "Greenhouse",
  "DetectionMethod": "URL pattern match",
  "LikelyUsesAI": true,
  "Disclaimer": "Detection shows the ATS in use...",
  "KnownAIVendors": [
    "HireVue",
    "Pymetrics",
    "Modern Hire"
  ],
  "Recommendation": "This company uses Greenhouse. Optimize your resume..."
}
```

---

## 🏠 Landlord Check API

### Check Landlord Records
**Endpoint**: `GET /api/LandlordCheck/check`

**Query Parameters**:
- `query` (required): Landlord name or address
- `city` (optional, default: "nyc"): City to search

**Example**: `/api/LandlordCheck/check?query=John%20Smith&city=nyc`

**Response** (200 OK):
```json
{
  "Found": true,
  "Query": "John Smith",
  "City": "NYC",
  "Summary": {
    "TotalViolations": 42,
    "TotalLitigations": 8,
    "RiskLevel": "High"
  },
  "RecentCases": [
    {
      "Type": "Litigation",
      "CaseType": "HP Action",
      "CaseOpenDate": "2024-01-15",
      "Status": "Open"
    }
  ],
  "Message": "Found 42 housing violations and 8 litigation cases.",
  "Disclaimer": "Data is specific to NYC..."
}
```

**Limited Coverage Response** (200 OK):
```json
{
  "Found": false,
  "Message": "Currently only NYC data is available.",
  "SupportedCities": ["NYC"]
}
```

---

## 📸 Face Dataset Check API

### Check Image URL
**Endpoint**: `POST /api/FaceDatasetCheck/check-url`

**Request Body**:
```json
{
  "ImageUrl": "https://example.com/photo.jpg"
}
```

**Response** (200 OK):
```json
{
  "ImageUrl": "https://example.com/photo.jpg",
  "CheckedDatasets": ["LAION-5B", "LAION-400M"],
  "Found": true,
  "Confidence": "High",
  "Message": "This image URL was found in the LAION-5B dataset...",
  "Disclaimer": "This check uses a pre-computed index...",
  "Resources": [
    {
      "Name": "Have I Been Trained?",
      "Url": "https://haveibeentrained.com/"
    }
  ]
}
```

### Check Uploaded Image
**Endpoint**: `POST /api/FaceDatasetCheck/check-upload`

**Request**: `multipart/form-data`
- `image` (file): Image file (JPEG, PNG, WebP, max 10MB)

**Response** (200 OK):
```json
{
  "ImageName": "photo.jpg",
  "ImageSize": 245678,
  "CheckedDatasets": ["LAION-5B (subset)", "LAION-400M (subset)"],
  "Found": true,
  "Similarity": 0.923,
  "Confidence": "Medium",
  "Message": "Found visually similar images in training datasets...",
  "Disclaimer": "Client-side embedding generation...",
  "TechnicalDetails": {
    "EmbeddingModel": "openai/clip-vit-base-patch32 (ONNX)",
    "IndexSize": "10M vectors (0.2% of LAION-5B)",
    "SearchMethod": "Approximate Nearest Neighbor (HNSW)",
    "ProcessingTime": "~2-3 seconds"
  }
}
```

**Error Response** (400 Bad Request):
```json
{
  "Error": "Invalid image format. Supported: JPEG, PNG, WebP"
}
```

---

## Common Response Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 400 | Bad Request (invalid input) |
| 404 | Not Found (no records) |
| 429 | Too Many Requests (rate limited) |
| 500 | Internal Server Error |

---

## Rate Limiting

Current rate limits (per external API):
- **Common Crawl**: ~240 requests/minute
- **infini-gram**: No documented limit (observed: fast)
- **FCC Open Data**: Generous (no official limit)
- **openFDA**: 240 requests/minute (1000/hour with key)
- **NYC Open Data**: 1000 requests/day (unauthenticated)

---

## Error Handling

All endpoints return consistent error format:

```json
{
  "Error": "Descriptive error message"
}
```

Common errors:
- `"Invalid phone number format"`
- `"Failed to query FCC database"`
- `"No FDA records found for this medication"`
- `"Image too large. Maximum size is 10MB."`

---

## CORS Configuration

CORS is enabled for all origins in development. In production, configure specific origins in `Program.cs`:

```csharp
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.WithOrigins("https://your-domain.com")
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});
```

---

## Testing with cURL

### AI Content Check
```bash
curl -X POST https://localhost:7xxx/api/AIContentCheck/check-url \
  -H "Content-Type: application/json" \
  -d '{"Url":"https://example.com"}'
```

### Robocall Check
```bash
curl https://localhost:7xxx/api/RobocallCheck/check/5551234567
```

### Medication Check
```bash
curl "https://localhost:7xxx/api/MedicationCheck/check?drugName=Tylenol"
```

### Job Screening Check
```bash
curl -X POST https://localhost:7xxx/api/JobScreeningCheck/check \
  -H "Content-Type: application/json" \
  -d '{"CompanyName":"Google","CareersUrl":"https://careers.google.com"}'
```

### Landlord Check
```bash
curl "https://localhost:7xxx/api/LandlordCheck/check?query=John%20Smith&city=nyc"
```

### Face Dataset Check (URL)
```bash
curl -X POST https://localhost:7xxx/api/FaceDatasetCheck/check-url \
  -H "Content-Type: application/json" \
  -d '{"ImageUrl":"https://example.com/photo.jpg"}'
```

### Face Dataset Check (Upload)
```bash
curl -X POST https://localhost:7xxx/api/FaceDatasetCheck/check-upload \
  -F "image=@photo.jpg"
```

---

## Performance Tips

1. **Caching**: Results can be cached for 1-24 hours depending on use case
2. **Batch Requests**: Queue multiple checks to avoid rate limits
3. **Async Calls**: All endpoints are async-friendly
4. **Timeout**: Set reasonable timeouts (10-30 seconds recommended)

---

## Future Enhancements

Planned API improvements:
- [ ] Pagination for large result sets
- [ ] Webhook support for async processing
- [ ] Bulk check endpoints
- [ ] Result export (CSV, JSON)
- [ ] Historical data tracking
- [ ] Scheduled monitoring

---

## Support

For API issues:
1. Check status pages of external APIs
2. Review logs for detailed error messages
3. Verify input format matches examples
4. Test with cURL to isolate frontend issues

---

## Data Source APIs

Direct links to external APIs used:

1. **Common Crawl CDX**: `https://index.commoncrawl.org/`
2. **infini-gram**: `https://api.infini-gram.io/`
3. **FCC**: `https://opendata.fcc.gov/`
4. **openFDA**: `https://api.fda.gov/`
5. **NYC Open Data**: `https://data.cityofnewyork.us/`

All external APIs are free and publicly accessible.
