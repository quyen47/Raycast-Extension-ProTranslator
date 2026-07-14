import React, { useState, useEffect } from "react";
import {
  List,
  ActionPanel,
  Action,
  Icon,
  Form,
  useNavigation,
  showToast,
  Toast,
  Detail,
} from "@raycast/api";
import { useFlashcards } from "./utils/flashcardUtil";
import { Flashcard } from "./types";
import { AIModule, getProviderConfig } from "./utils/providerUtil";
import { playAudio } from "./utils/audioUtil";

type InsightData = {
  type: "reading" | "exercise";
  markdown?: string;
  question?: string;
  answer?: string;
  translation?: string;
};

function ExerciseScreen({
  data,
  onNext,
}: {
  data: InsightData;
  onNext: () => void;
}) {
  const { pop } = useNavigation();
  const [userAnswer, setUserAnswer] = useState("");
  const [showResult, setShowResult] = useState(false);
  const [error, setError] = useState<string>();

  function handleSubmit() {
    if (showResult) {
      pop();
      onNext();
      return;
    }
    if (!userAnswer.trim()) {
      setError("Please type your answer.");
      return;
    }
    const correct = userAnswer.trim().toLowerCase() === data.answer!.toLowerCase();
    if (correct) {
      showToast({ title: "Correct!", style: Toast.Style.Success });
      setShowResult(true);
    } else {
      setError("Incorrect! Try again.");
    }
  }

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title={showResult ? "Continue" : "Submit Answer"}
            onSubmit={handleSubmit}
          />
          {showResult && (
            <Action
              title="Listen"
              icon={Icon.SpeakerOn}
              onAction={() => playAudio(data.answer!)}
              shortcut={{ modifiers: ["cmd"], key: "p" }}
            />
          )}
          <Action
            title="Skip"
            onAction={() => {
              pop();
              onNext();
            }}
            shortcut={{ modifiers: ["cmd"], key: "s" }}
          />
        </ActionPanel>
      }
    >
      <Form.Description text="Fill in the blank with the word you just learned!" />
      <Form.Separator />
      <Form.Description text={`🇺🇸 ${data.question}`} />
      <Form.Description text={`🇻🇳 ${data.translation}`} />

      {!showResult ? (
        <Form.TextField
          id="ans"
          title="Your Answer"
          value={userAnswer}
          onChange={(v) => {
            setUserAnswer(v);
            setError(undefined);
          }}
          error={error}
        />
      ) : (
        <Form.Description text={`✅ Correct! The word is: ${data.answer}`} />
      )}
    </Form>
  );
}

function InsightScreen({
  flashcard,
  onNext,
  addInsight,
}: {
  flashcard: Flashcard;
  onNext: () => void;
  addInsight: (id: string, insight: string) => Promise<void>;
}) {
  const { pop } = useNavigation();
  const [insightData, setInsightData] = useState<InsightData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function fetchInsight() {
      try {
        const cachedInsights = flashcard.insights || [];
        let shouldFetchNew = true;

        if (cachedInsights.length >= 3) {
          shouldFetchNew = Math.random() < 0.2; // 20% chance to fetch new
        } else if (cachedInsights.length > 0) {
          shouldFetchNew = Math.random() < 0.5; // 50% chance
        }

        if (!shouldFetchNew && cachedInsights.length > 0) {
           const randomInsightStr = cachedInsights[Math.floor(Math.random() * cachedInsights.length)];
           if (isMounted) {
             try {
               setInsightData(JSON.parse(randomInsightStr));
             } catch (e) {
               setInsightData({ type: "reading", markdown: randomInsightStr });
             }
             setIsLoading(false);
           }
           return;
        }

        const config = getProviderConfig();
        if (!config.apiKey) {
           if (isMounted) {
             setInsightData({ type: "reading", markdown: "⚠️ Please set your API key in preferences to see AI Insights." });
             setIsLoading(false);
           }
           return;
        }

        const ai = new AIModule(config);
        const newInsightStr = await ai.generateVocabInsight(flashcard.term, flashcard.definition);
        
        let parsed: InsightData;
        try {
          parsed = JSON.parse(newInsightStr.replace(/```json/g, "").replace(/```/g, ""));
        } catch (e) {
          parsed = { type: "reading", markdown: newInsightStr };
        }

        if (isMounted) {
          setInsightData(parsed);
          setIsLoading(false);
        }
        
        // Save to cache (save as string)
        await addInsight(flashcard.id, JSON.stringify(parsed));

      } catch (error) {
        if (isMounted) {
          setInsightData({ type: "reading", markdown: "⚠️ Could not generate insight. Please check your internet or API key." });
          setIsLoading(false);
        }
      }
    }
    fetchInsight();
    return () => {
      isMounted = false;
    };
  }, [flashcard]);

  if (!isLoading && insightData?.type === "exercise") {
    return <ExerciseScreen data={insightData} onNext={onNext} />;
  }

  return (
    <Detail
      isLoading={isLoading}
      markdown={insightData?.markdown || "✨ Generating AI Insight..."}
      actions={
        <ActionPanel>
          <Action
            title="Continue to Next Flashcard"
            icon={Icon.Forward}
            onAction={() => {
              pop(); // Pop InsightScreen
              onNext(); // This will trigger handleNext which pops QuizScreen
            }}
          />
        </ActionPanel>
      }
    />
  );
}

function QuizScreen({
  flashcard,
  onNext,
  addInsight,
}: {
  flashcard: Flashcard;
  onNext: (isCorrect: boolean) => void;
  addInsight: (id: string, insight: string) => Promise<void>;
}) {
  const { push, pop } = useNavigation();
  const [error, setError] = useState<string | undefined>();
  const [showResult, setShowResult] = useState(false);
  const [isAnswerCorrect, setIsAnswerCorrect] = useState(false);
  const [userAnswer, setUserAnswer] = useState("");

  // Randomly decide which side to show
  // false = show definition, guess term
  // true = show term, guess definition
  const [isReverse] = useState(() => Math.random() > 0.5);

  const questionText = isReverse ? flashcard.term : flashcard.definition;
  const expectedAnswer = isReverse ? flashcard.definition : flashcard.term;

  function handleSubmit() {
    if (showResult) {
      // Proceed to Insight Screen before next card
      push(
        <InsightScreen
          flashcard={flashcard}
          onNext={() => onNext(isAnswerCorrect)}
          addInsight={addInsight}
        />,
      );
      return;
    }

    if (!userAnswer.trim()) {
      setError("Please type your answer.");
      return;
    }

    const isCorrect =
      userAnswer.trim().toLowerCase() === expectedAnswer.toLowerCase();
    setIsAnswerCorrect(isCorrect);
    setShowResult(true);

    if (isCorrect) {
      showToast({ style: Toast.Style.Success, title: "Correct!" });
    } else {
      showToast({
        style: Toast.Style.Failure,
        title: "Incorrect",
        message: `Correct answer: ${expectedAnswer}`,
      });
    }
  }

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title={showResult ? "Next Card" : "Submit Answer"}
            onSubmit={handleSubmit}
          />
          <Action
            title="Listen to Question"
            icon={Icon.SpeakerOn}
            onAction={() => playAudio(questionText)}
            shortcut={{ modifiers: ["cmd"], key: "p" }}
          />
          {showResult && (
            <Action
              title="Listen to Answer"
              icon={Icon.SpeakerOn}
              onAction={() => playAudio(expectedAnswer)}
              shortcut={{ modifiers: ["cmd", "shift"], key: "p" }}
            />
          )}
          <Action
            title="Skip"
            onAction={() => onNext(false)}
            shortcut={{ modifiers: ["cmd"], key: "s" }}
          />
          <Action
            title="Exit Quiz"
            onAction={() => pop()}
            shortcut={{ modifiers: ["cmd"], key: "e" }}
          />
        </ActionPanel>
      }
    >
      <Form.Description
        text={
          isReverse
            ? "Type the DEFINITION for this term:"
            : "Type the TERM that matches this definition:"
        }
      />
      <Form.Description text={`Question: ${questionText}`} />

      {showResult && (
        <>
          <Form.Separator />
          <Form.Description
            text={
              isAnswerCorrect
                ? "✅ Correct!"
                : `❌ Incorrect! The right answer is: ${expectedAnswer}`
            }
          />
          {flashcard.example && (
            <Form.Description text={`💡 Example: ${flashcard.example}`} />
          )}
        </>
      )}

      <Form.Separator />

      {!showResult ? (
        <Form.TextField
          id="answer"
          title="Your Answer"
          placeholder="Type here..."
          value={userAnswer}
          error={error}
          onChange={(val) => {
            setUserAnswer(val);
            setError(undefined);
          }}
        />
      ) : (
        <Form.Description text={`Your Answer: ${userAnswer}`} />
      )}
    </Form>
  );
}

export default function PracticeVocabCommand() {
  const { data, isLoading, remove, updateStats, addInsight } = useFlashcards();
  const [mode, setMode] = useState<"manage" | "quiz">("manage");

  // Quiz state
  const { push, pop } = useNavigation();
  const quizFilterRef = React.useRef<"due" | "all">("due");

  function getActiveCards(filter: "due" | "all") {
    if (filter === "all") return data;
    return data.filter((card) => {
      if (!card.dueDate) return true;
      return new Date(card.dueDate) <= new Date();
    });
  }

  function startQuiz(filter: "due" | "all") {
    quizFilterRef.current = filter;
    const activeCards = getActiveCards(filter);

    if (activeCards.length === 0) {
      if (filter === "due") {
        showToast({
          style: Toast.Style.Failure,
          title: "You're all caught up!",
          message: "No flashcards due today.",
        });
      } else {
        showToast({
          style: Toast.Style.Failure,
          title: "No flashcards",
          message: "You don't have any flashcards yet.",
        });
      }
      return;
    }

    // Pick a random card from active cards
    const randomCard =
      activeCards[Math.floor(Math.random() * activeCards.length)];
    push(
      <QuizScreen
        flashcard={randomCard}
        onNext={(isCorrect) => handleNext(randomCard.id, isCorrect)}
        addInsight={addInsight}
      />,
    );
  }

  async function handleNext(cardId: string, isCorrect: boolean) {
    await updateStats(cardId, isCorrect);
    pop(); // Close current form

    // Slight delay to allow toast and UI update
    setTimeout(() => {
      const activeCards = getActiveCards(quizFilterRef.current);
      // Remove the one just answered if we are in "due" mode and it was correct?
      // Actually, if it's "all" mode, they could practice infinitely. To prevent infinite loops on the same card immediately,
      // let's just pick any card, maybe excluding the one they just did if there are others.
      const availableCards = activeCards.filter(
        (c) => c.id !== cardId || activeCards.length === 1,
      );

      // If due mode, we should really only show it if it's still due.
      // updateStats changes the dueDate, so if they answered, its dueDate is now in the future (even if wrong, it's due tomorrow).
      // So if getActiveCards is called with fresh data, it might already exclude it.
      // But React hook state `data` might be stale inside this timeout if we don't use a ref.
      // So filtering out `cardId` manually is a safe approximation for the immediate next question.
      let nextCards = availableCards;
      if (quizFilterRef.current === "due") {
        nextCards = availableCards.filter((c) => c.id !== cardId || !isCorrect);
      }

      if (nextCards.length > 0) {
        const randomCard =
          nextCards[Math.floor(Math.random() * nextCards.length)];
        push(
          <QuizScreen
            flashcard={randomCard}
            onNext={(isC) => handleNext(randomCard.id, isC)}
            addInsight={addInsight}
          />,
        );
      } else {
        showToast({ style: Toast.Style.Success, title: "Session Complete!" });
      }
    }, 100);
  }

  const dueCount = getActiveCards("due").length;

  return (
    <List
      isLoading={isLoading}
      searchBarAccessory={
        <List.Dropdown
          tooltip="Mode"
          onChange={(val) => setMode(val as "manage" | "quiz")}
          value={mode}
        >
          <List.Dropdown.Item title="Manage Flashcards" value="manage" />
          <List.Dropdown.Item title="Quiz Mode" value="quiz" />
        </List.Dropdown>
      }
    >
      {mode === "manage" && (
        <List.Section
          title="Your Flashcards"
          subtitle={`${data.length} total, ${dueCount} due today`}
        >
          {data.length === 0 ? (
            <List.EmptyView
              title="No Flashcards"
              description="Save items from History to create flashcards."
            />
          ) : (
            data.map((card) => (
              <List.Item
                key={card.id}
                title={card.term}
                subtitle={card.definition}
                accessories={[
                  {
                    text: card.dueDate
                      ? new Date(card.dueDate).toLocaleDateString()
                      : "",
                    tooltip: "Next review",
                  },
                  {
                    text: `✅ ${card.correctCount}`,
                    tooltip: "Correct answers",
                  },
                ]}
                actions={
                  <ActionPanel>
                    <Action
                      title="Start Due Cards Quiz"
                      icon={Icon.Play}
                      onAction={() => startQuiz("due")}
                    />
                    <Action
                      title="Start Cram Quiz (All)"
                      icon={Icon.Forward}
                      onAction={() => startQuiz("all")}
                    />
                    <Action
                      title="Delete Flashcard"
                      icon={Icon.Trash}
                      style={Action.Style.Destructive}
                      shortcut={{ modifiers: ["ctrl"], key: "x" }}
                      onAction={() => remove(card.id)}
                    />
                  </ActionPanel>
                }
              />
            ))
          )}
        </List.Section>
      )}

      {mode === "quiz" && (
        <List.Section title="Practice">
          <List.Item
            title={
              dueCount === 0 ? "You're all caught up!" : "Start Vocabulary Quiz"
            }
            subtitle={
              dueCount === 0
                ? "No cards due today."
                : `${dueCount} cards due today`
            }
            icon={dueCount === 0 ? Icon.CheckCircle : Icon.GameController}
            actions={
              <ActionPanel>
                {dueCount > 0 && (
                  <Action
                    title="Start Due Cards Quiz"
                    icon={Icon.Play}
                    onAction={() => startQuiz("due")}
                  />
                )}
                <Action
                  title="Start Cram Quiz (All Cards)"
                  icon={Icon.Forward}
                  onAction={() => startQuiz("all")}
                />
              </ActionPanel>
            }
          />
        </List.Section>
      )}
    </List>
  );
}
