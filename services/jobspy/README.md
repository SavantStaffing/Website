# JobSpy service (optional)

The Job Scout's **job-board** source: LinkedIn, Indeed, Google Jobs, Glassdoor
and ZipRecruiter, through the open-source [JobSpy](https://github.com/speedyapply/JobSpy)
library. JobSpy is Python, so it runs as a small separate service that the site calls.

> **Read before enabling.** These sites' terms of use prohibit automated
> scraping, and they actively block it (expect 429s and CAPTCHAs, which show
> up on /admin/diagnostics). Running this is a legal and account risk that
> Savant takes on. The company-ATS source (Greenhouse, Lever, Ashby,
> SmartRecruiters, Workable) uses public, documented APIs and has no such risk.
> Prefer adding companies to Job Scout over enabling boards.

## Run

```bash
pip install fastapi uvicorn python-jobspy
JOBSPY_TOKEN=change-me uvicorn main:app --host 0.0.0.0 --port 8000
```

Then on the site's server set `JOBSPY_URL=https://<where-this-runs>` and, in
**Admin → Settings → Job boards**, enable the boards and add searches.

Set the same `JOBSPY_TOKEN` on both the service and the site's server; the
site sends it as a bearer token. It's optional, but set it once the service is
reachable from the internet.
