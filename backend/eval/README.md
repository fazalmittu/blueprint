# Evaluation System

This directory contains the evaluation harness for testing search strategies against real meeting data.

## Quick Start (After Cloning Repo)

The database (`backend/data/blueprint.db`) and search indices (`backend/data/faiss/`) are **already committed to git**, so you can start immediately:

```bash
cd backend

# 1. Install dependencies
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt

# 2. Database and indices are already ready! Just run eval:
python -m eval.run \
  --dataset eval/eval_data/ground_truth.json \
  --strategies title_first \
  --k 3 5 10 \
  --out eval/results
```

## Regenerating the Database

If you need to regenerate the database (e.g., with more meetings):

```bash
cd backend
source venv/bin/activate

# Generate 30 meetings (default) with longest transcripts
python seed_meetingbank.py

# Or specify number of meetings
python seed_meetingbank.py --n 50

# Skip indexing if you just want to test data generation
python seed_meetingbank.py --skip-indexing

# Skip ground truth generation if you just want the database
python seed_meetingbank.py --skip-questions
```

**Note**: This takes ~30-45 minutes due to LLM API calls. The generated database and indices will be committed to git.

## What Gets Created

- **30 meetings** (default) from MeetingBank dataset with longest transcripts
- All meetings belong to org: `eval-org`
- Each meeting includes:
  - Full transcript
  - AI-generated title
  - AI-generated summary
  - Workflows extracted from discussion
  - Chunked transcript for retrieval

## Database Location

- **Database**: `backend/data/blueprint.db` (SQLite)
- **Search Indices**: `backend/data/faiss/*.index` (FAISS)
- **Metadata**: `backend/data/faiss/search_metadata.db` (SQLite)

All of these are **committed to git** so cloning gives you a fully functional system.

## Evaluation Output

Each eval run creates a timestamped directory in `eval/results/`:

```
eval/results/
└── 20260112-130500/
    ├── ground_truth.json      # Summary metrics
    ├── ground_truth.md        # Human-readable report
    ├── ground_truth-cases.json # Per-case details
    └── plots/                 # Metric visualizations
        ├── recall@3.png
        ├── recall@5.png
        └── recall@10.png
```

## Metrics Computed

- **Recall@K**: What fraction of relevant docs appear in top K results?
- **Precision@K**: What fraction of top K results are relevant?
- **Hit@K**: Did we get at least one relevant doc in top K?
- **MRR**: Mean reciprocal rank of first relevant doc
- **NDCG@K**: Normalized discounted cumulative gain (position-aware)

## Directory Structure

```
eval/
├── README.md                    # This file
├── __init__.py                  # Package init
├── dataset.py                   # Ground truth data structures
├── metrics.py                   # IR metrics (Recall, Precision, etc.)
├── runner.py                    # Evaluation orchestration
├── report.py                    # Result formatting and plotting
├── run.py                       # CLI entry point
├── generate_synthetic.py         # Generate test cases from DB
├── eval_data/                   # Test data
│   └── ground_truth.json        # Test cases (committed)
└── results/                     # Evaluation outputs (not committed)
    └── 20260112-130500/         # Timestamped run directories
```

## Notes

- The old `seed_db.py` script is deprecated but kept for reference
- All MeetingBank meetings use the same org ID (`eval-org`) to simplify testing
- Database and indices are committed to git - no need to regenerate unless you want different data
- Ground truth test cases are generated automatically when seeding (unless `--skip-questions`)
