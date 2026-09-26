"""JobSpy wrapper for the Savant Job Scout's job-board source.

POST /scrape {search_term, location?, sites[], results_wanted?, hours_old?}
  -> list of postings, one per row of JobSpy's DataFrame.

Only reachable with the shared secret (JOBSPY_TOKEN) if you set one.
Read README.md before enabling: these sites prohibit automated scraping.
"""
import math
import os

from fastapi import FastAPI, Header, HTTPException
from jobspy import scrape_jobs
from pydantic import BaseModel, Field

app = FastAPI(title="Savant JobSpy")
TOKEN = os.getenv("JOBSPY_TOKEN")
ALLOWED_SITES = {"linkedin", "indeed", "google", "glassdoor", "zip_recruiter"}


class ScrapeRequest(BaseModel):
    search_term: str = Field(min_length=2, max_length=120)
    location: str | None = Field(default=None, max_length=120)
    sites: list[str]
    results_wanted: int = Field(default=50, ge=1, le=200)
    hours_old: int = Field(default=72, ge=1, le=720)


def _clean(value):
    if value is None or (isinstance(value, float) and math.isnan(value)):
        return None
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return value


@app.post("/scrape")
def scrape(req: ScrapeRequest, authorization: str | None = Header(default=None)):
    if TOKEN and authorization != f"Bearer {TOKEN}":
        raise HTTPException(401, "Unauthorized")
    sites = [s for s in req.sites if s in ALLOWED_SITES]
    if not sites:
        raise HTTPException(400, "No supported sites requested")
    df = scrape_jobs(
        site_name=sites,
        search_term=req.search_term,
        google_search_term=f"{req.search_term} jobs near {req.location}" if req.location else req.search_term,
        location=req.location,
        results_wanted=req.results_wanted,
        hours_old=req.hours_old,
        country_indeed="USA",
    )
    return [{k: _clean(v) for k, v in row.items()} for row in df.to_dict(orient="records")]
