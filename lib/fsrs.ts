
export type ReviewRating = 1 | 2 | 3 | 4; // 1=Again, 2=Hard, 3=Good, 4=Easy

export interface FSRSProgress {
    stability: number; // Interval in days (how long memory lasts)
    difficulty: number; // 0-10 (how hard the item is)
    repetition_count: number;
    last_review_at: Date;
    next_review_at: Date;
    state: 'New' | 'Learning' | 'Review' | 'Relearning';
}

/**
 * Calculates the next review interval based on a simplified FSRS/SM-2 hybrid algo.
 */
export function calculateNextReview(
    current: FSRSProgress | null,
    rating: ReviewRating
): FSRSProgress {
    const now = new Date();

    // Default initial state if new
    let stability = current?.stability || 0;
    let difficulty = current?.difficulty || 5; // Start middle difficulty
    let repetition_count = current?.repetition_count || 0;
    let state = current?.state || 'New';

    // 1. Update Difficulty
    // Rating 1 (Again) -> increase difficulty
    // Rating 4 (Easy) -> decrease difficulty
    // Formula: D_new = D_old - 0.8 * (Rating - 3)
    // We clamp D between 1 and 10
    const ratingMsg = rating === 1 ? -2 : rating === 2 ? -1 : rating === 3 ? 0 : 1;
    // Actually standard mapping: 1=Again(Fail), 2=Hard, 3=Good, 4=Easy
    // Let's use specific adjustments:
    if (rating === 1) difficulty += 2;      // Forgot -> Harder
    else if (rating === 2) difficulty += 1; // Hard -> Slightly Harder
    else if (rating === 3) difficulty -= 0.5; // Good -> Slightly Easier
    else if (rating === 4) difficulty -= 1.5; // Easy -> Easier

    // Clamp difficulty
    difficulty = Math.max(1, Math.min(10, difficulty));

    // 2. Update Stability (Interval)
    if (rating === 1) {
        // FORGOT (Again)
        state = 'Relearning';
        stability = 0.5; // Review in 12 hours (0.5 days) approx, effectively "today/tomorrow"
        repetition_count = 0; // Reset count or keep tracking? Let's reset streak but keep total count logic separate if needed. 
        // For simple FSRS/SM-2, usually streak resets.
    } else {
        // SUCCESS (Hard, Good, Easy)
        if (state === 'New' || state === 'Relearning') {
            // First success
            state = 'Learning';
            stability = rating === 2 ? 1 : rating === 3 ? 3 : 5; // 1, 3, or 5 days initial
        } else {
            // Continuation (Review)
            state = 'Review';
            // Multiplier based on difficulty and rating
            // Easy Bonus: 1.5, Hard Penalty: 0.8
            // Difficulty Factor: (11 - D) / 2  ->  (11-1)/2=5x (easy item), (11-10)/2=0.5x (hard item)
            // Let's use a standard SM-2 style multiplier:
            // EF (Easiness Factor) ~ (11 - Difficulty) * 0.5 + 1? No, let's keep it simple.

            let factor = 2.5; // Base factor
            // Adjust factor by difficulty (higher difficulty = lower factor)
            factor -= (difficulty - 5) * 0.2;
            // Adjust by rating
            if (rating === 4) factor *= 1.3;
            if (rating === 2) factor *= 0.8;

            factor = Math.max(1.2, factor); // Minimum growth 20%

            stability = stability * factor;
        }
        repetition_count++;
    }

    // 3. Calculate Next Date
    // stability is in days
    // Add logic: if stability < 1 (e.g. 0.5), it means "Review soon (Session)". 
    // For DB simplicity, we use Days. 
    // If < 1 day, user should review 'today' or 'tomorrow'.

    const nextReview = new Date(now.getTime() + stability * 24 * 60 * 60 * 1000);

    return {
        stability,
        difficulty,
        repetition_count,
        last_review_at: now,
        next_review_at: nextReview,
        state
    };
}
