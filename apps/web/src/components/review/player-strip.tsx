import type { ReviewPlayerIdentity } from "../../lib/player-identity";

function initials(username: string): string {
  const words = username.trim().split(/\s+/).filter(Boolean);
  return (words.length > 1 ? `${words[0]?.[0] ?? ""}${words.at(-1)?.[0] ?? ""}` : username.slice(0, 2)).toLocaleUpperCase();
}

export function PlayerStrip({ player }: { player: ReviewPlayerIdentity }) {
  return (
    <div className={`player-strip player-${player.color}`}>
      <span
        className="player-avatar"
        aria-hidden="true"
      >
        <span>{initials(player.username)}</span>
        {player.avatarUrl && (
          // Provider avatars come from arbitrary public hosts, so Next Image's
          // static remote-host allowlist is not the right boundary here.
          <img
            key={`${player.color}:${player.username}:${player.avatarUrl}`}
            src={player.avatarUrl}
            alt=""
            referrerPolicy="no-referrer"
            onLoad={(event) => { event.currentTarget.hidden = false; }}
            onError={(event) => { event.currentTarget.hidden = true; }}
          />
        )}
      </span>
      <span className="player-name">
        <strong title={player.username}>{player.username}</strong>
        <small>
          {player.color === "white" ? "White" : "Black"}
          {player.connected && player.provider ? ` · ${player.provider === "chesscom" ? "Chess.com" : "Lichess"} account` : ""}
        </small>
      </span>
      <strong className="player-rating">{player.rating ?? "—"}</strong>
    </div>
  );
}
