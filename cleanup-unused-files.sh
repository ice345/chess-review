#!/usr/bin/env bash
#
# cleanup-unused-files.sh
#
# Remove superseded audits, obsolete briefs and local browser-capture artifacts
# from this repository. Nothing outside the three lists below is touched.
#
#   ./cleanup-unused-files.sh                 dry run - list what would be removed
#   ./cleanup-unused-files.sh --yes           remove it
#   ./cleanup-unused-files.sh --yes --force   also remove tracked files that still
#                                             have uncommitted changes
#
# Group A  Audit and design records that mark themselves `Status: Historical`.
#          Their findings are implemented; docs/roadmap.md is the live record.
# Group B  Superseded review/design audits, plus one-off briefs whose content now
#          lives in AGENTS.md and docs/.
# Group C  Local capture artifacts. Regenerable at any time and never committed.
#
# Group A and B are tracked by git, so `git restore -- <path>` brings them back.
# Group C is untracked and cannot be recovered.
#
# Deliberately NOT touched: docs/design/{audits,implementation,proposals,
# prototypes}/, packages/ui/assets/, apps/web/public/atmosphere/ and
# scripts/capture-*.mjs -- those belong to the in-flight work, not to history.

set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"

CONFIRM=0
FORCE=0

usage() {
	sed -n '3,25p' "$0"
}

for arg in "$@"; do
	case "$arg" in
		-y | --yes) CONFIRM=1 ;;
		--force) FORCE=1 ;;
		-n | --dry-run) CONFIRM=0 ;;
		-h | --help)
			usage
			exit 0
			;;
		*)
			echo "unknown argument: $arg (try --help)" >&2
			exit 2
			;;
	esac
done

if [[ ! -f AGENTS.md || ! -f package.json ]]; then
	echo "error: run this script from the repository root" >&2
	exit 1
fi

GROUP_A=(
	docs/audits
	docs/Open_Chess_Review_Final_Product_Refinement_Audit_2026-09-14.md
	docs/Open_Chess_Review_Windowlight_Final_Audit.md
	docs/design/2026-09-05-bluebird-design-plan.md
	docs/design/2026-09-13-windowlight-implementation.md
	docs/design/2026-09-14-board-ergonomics-and-shortcuts.md
	docs/design/2026-09-14-board-feedback-preferences.md
	docs/design/2026-09-14-feather-porcelain-v1-1-integration.md
	docs/design/2026-09-14-guided-review.md
	docs/design/2026-09-14-mobile-parity-and-acceptance.md
	docs/design/2026-09-14-opening-explorer.md
	docs/design/2026-09-14-tablebase.md
	docs/design/2026-09-15-review-desk-and-withheld-answers.md
)

GROUP_B=(
	docs/design/Open_Chess_Review_Visual_Audit_2026-09-18.md
	docs/design/Open_Chess_Review_Windowlight_Bluebird_V3_Perfect_Design_Audit.md
	docs/design/bluebird-v2
	docs/web-release-roadmap.md
	FIX.md
	Prompt.md
	open-chess-review-ai-brief.md
)

GROUP_C=(
	.home-shots
	tmp
	.tmp-ui-pass
	.ocr-live-audit
	playwright-report
	test-results
	page-screenshot.png
)

kb_of() { du -sk "$1" 2>/dev/null | awk '{print $1}'; }
human() { awk -v k="$1" 'BEGIN { if (k >= 1024) printf "%.1f MB", k / 1024; else printf "%d KB", k }'; }

present=()
for path in "${GROUP_A[@]}" "${GROUP_B[@]}" "${GROUP_C[@]}"; do
	[[ -e "$path" ]] && present+=("$path")
done

if (( ${#present[@]} == 0 )); then
	echo "nothing to remove - the tree is already clean"
	exit 0
fi

dirty=()
total_kb=0
for path in "${present[@]}"; do
	total_kb=$((total_kb + $(kb_of "$path")))
	if git ls-files --error-unmatch -- "$path" >/dev/null 2>&1 &&
		[[ -n "$(git status --porcelain -- "$path")" ]]; then
		dirty+=("$path")
	fi
done

echo "would remove ${#present[@]} path(s), $(human "$total_kb"):"
echo
for path in "${present[@]}"; do
	printf '  %-72s %s\n' "$path" "$(human "$(kb_of "$path")")"
done
echo

if (( ${#dirty[@]} > 0 )); then
	echo "these are tracked AND have uncommitted changes - deleting them would lose that work:"
	for path in "${dirty[@]}"; do
		printf '  %s\n' "$path"
	done
	echo
	if (( FORCE == 0 )); then
		echo "commit or discard those changes first, then re-run."
		echo "to drop them anyway, pass --force."
		exit 1
	fi
	echo "continuing because --force was passed."
	echo
fi

if (( CONFIRM == 0 )); then
	echo "dry run - nothing was deleted. re-run with --yes to delete."
	exit 0
fi

for path in "${present[@]}"; do
	kb=$(kb_of "$path")
	rm -rf -- "$path"
	printf 'removed  %-72s %s\n' "$path" "$(human "$kb")"
done

echo
echo "done. $(human "$total_kb") reclaimed."
echo "group A/B were tracked: 'git restore -- <path>' brings any of them back."
