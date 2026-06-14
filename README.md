# CDIAL Explorer — Shina & Dardic Dictionary

A browser-based explorer for **Turner's Comparative Dictionary of the Indo-Aryan Languages (CDIAL)**, with a focus on **Shina** and other **Dardic languages**. Built as a lightweight frontend backed by a PHP/JSON API.

## Features

- **Full-text search** across headwords, glosses, and Shina forms
- **Filter by language family** — Dardic, NIA, MIA, OIA, Kafiri, Iranian
- **Filter by Shina dialect** — Gilgiti, Kohistani, Guresi, Palesi, Brokpa, Puniali, Dras, and more
- **Shina-only mode** to surface only entries with attested Shina forms
- **Inherited gloss filter** to show entries where the Shina gloss is inherited from the proto-form
- **Per-entry detail view** with tabbed panels:
  - Shina attestations with per-dialect breakdown
  - All languages grouped by family
  - Raw source text
  - Cross-references (clickable)
- **Etymology line** per entry (toggleable)
- **Pagination** with configurable page size (10 / 25 / 50 / 100)
- **Shareable URLs** — all filter/search/page state is reflected in the query string
- Sidebar stats: total entries, entries with Shina, total Shina forms, current result count

## Project Structure

```
.
├── index.html      # Main UI — layout, filters, search bar
├── script.js       # All frontend logic — state, fetch, render, pagination
├── style.css       # Styling (CSS variables, cards, chips, tabs, etc.)
└── api.php         # Backend API (hosted at kaz.alwaysdata.net)
```

## API

The frontend talks to a remote PHP API:

```
GET https://kaz.alwaysdata.net/api.php
```

### Query Parameters

| Parameter   | Description                                      |
|-------------|--------------------------------------------------|
| `q`         | Search string (headword, gloss, Shina form)      |
| `filter`    | `all` or `shina`                                 |
| `family`    | Language family (`Dardic`, `NIA`, `MIA`, etc.)   |
| `dialect`   | Shina dialect abbreviation (`gil.`, `koh.`, …)   |
| `sort`      | `num` (entry number) or `alpha` (A–Z)            |
| `page`      | Page number                                      |
| `per_page`  | Results per page (10–100)                        |
| `inherited` | `1` to filter inherited-gloss entries only       |
| `stats`     | `1` to return aggregate stats instead of entries |
| `id`        | Single entry ID for full detail fetch            |

### Response (entries)

```json
{
  "entries": [...],
  "total": 4200,
  "page": 1,
  "per_page": 25,
  "total_pages": 168
}
```

### Response (stats)

```json
{
  "total": 9000,
  "with_shina": 1200,
  "shina_forms": 3400
}
```

## Supported Shina Dialects

| Abbreviation | Dialect     |
|--------------|-------------|
| `gil.`       | Gilgiti     |
| `koh.`       | Kohistani   |
| `gur.`       | Guresi      |
| `pales.`     | Palesi      |
| `bro.`       | Brokpa      |
| `punl.`      | Puniali     |
| `dr.`        | Dras        |
| `jij.`       | Jijelut     |
| `chil.`      | Chilasi     |

## Running Locally

The frontend is fully static — just serve `index.html` from any web server or open it directly in a browser. It fetches all data from the remote API.

```bash
# e.g. with Python
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

> **Note:** The API is hosted externally. No local backend setup is required.

## Source

Based on **R.L. Turner's** *Comparative Dictionary of the Indo-Aryan Languages* (1966), which covers over 140 languages and dialects descended from Old Indo-Aryan.

## License

See repository for license information.
