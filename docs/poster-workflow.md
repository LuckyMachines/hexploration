# Xenovoya poster workflow

The poster workflow combines the campaign key art with exact gameplay captures. It generates two gameplay-led PNG posters plus lightweight JPEG copies of all four posters for email and review.

## Run it

From the `hexploration` repository root in Git Bash or PowerShell:

```text
python scripts/compose-gameplay-posters.py
```

The script validates its key art, gameplay captures, and fonts before rendering. It exits with a list of any missing inputs rather than producing partial output.

## Inputs

- Campaign key art in `app/public/images/posters/`
- Board states in `app/public/design-system-pngs/`
- Rescue-loop capture in the adjacent `xenovoya-coordinator` repository
- Barlow Condensed and JetBrains Mono fonts in `app/public/fonts/`

The gameplay frames are composited without generative alteration so the posters show the real interface.

## Outputs

- `app/public/images/posters/xenovoya-poster-gameplay-vertical.png`
- `app/public/images/posters/xenovoya-poster-gameplay-landscape.png`
- Four full-resolution email-ready JPEGs in `app/public/images/posters/email/`

The JPEG exports preserve the original dimensions while keeping the four-attachment package comfortably below Gmail's attachment limit.
