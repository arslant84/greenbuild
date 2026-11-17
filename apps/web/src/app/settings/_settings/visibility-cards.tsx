"use client";

import { RadioButtonCheckedIcon, RadioButtonUncheckedIcon } from "../../../ui/icons-settings";
import { useVisibility } from "./use-visibility";

interface Choice {
  title: string;
  note: string;
  // The game_profile_public value the card sets; null for a choice that does not exist yet.
  isPublic: boolean | null;
}

const CHOICES: Choice[] = [
  { title: "Public", note: "Anyone can view your game profile at /u/your-handle.", isPublic: true },
  // Being findable by companies while hidden from visitors needs company search (Stage 3).
  { title: "Companies only", note: "Hidden from visitors; only verified companies can find you, without your name.", isPublic: null },
  { title: "Hidden", note: "Only you can view your profile, and the leaderboards list you without a name.", isPublic: false },
];

// Frame 7:10273 › Visibility & Privacy Controls › the three visibility cards. Public and Hidden set
// game_profile_public at once; Companies only arrives with Stage 3 and shows disabled.
export function VisibilityCards({ initialPublic }: { initialPublic: boolean }) {
  const visibility = useVisibility(initialPublic);
  return (
    <div className="flex flex-col gap-1">
      <div role="radiogroup" aria-label="Game profile visibility" className="grid grid-cols-1 gap-2 lg:grid-cols-3">
        {CHOICES.map((choice) => {
          const available = choice.isPublic !== null;
          const selected = available && choice.isPublic === visibility.isPublic;
          return (
            <label key={choice.title} className={`rounded-lg bg-surface p-3 ${available ? "cursor-pointer" : "cursor-not-allowed opacity-60"} ${selected ? "outline-1 outline-accent" : ""}`}>
              <input
                type="radio"
                name="game-profile-visibility"
                className="sr-only"
                checked={selected}
                disabled={!available || visibility.saving}
                onChange={() => choice.isPublic !== null && void visibility.save(choice.isPublic)}
              />
              <span className="flex items-center justify-between type-body font-semibold text-ink">
                {choice.title}
                {selected ? <RadioButtonCheckedIcon className="text-[18px] text-accent" /> : <RadioButtonUncheckedIcon className="text-[18px] text-ink-subtle" />}
              </span>
              <span className="mt-2 block type-label text-ink-subtle">{choice.note}</span>
            </label>
          );
        })}
      </div>
      {visibility.failed && (
        <p role="alert" className="type-label text-danger">
          Your choice was not saved. Try again.
        </p>
      )}
    </div>
  );
}
