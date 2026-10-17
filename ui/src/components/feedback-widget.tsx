import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { MessageCircle, X } from "lucide-react";
import { type ReactNode, useState } from "react";
import { toast } from "sonner";
import { useApiClient } from "@/app";
import { Button, SegmentedToggle, Skeleton, Textarea } from "@/components";
import { useLegionAccess } from "@/hooks/use-legion-access";
import { FEEDBACK_TEXT_MAX, feedbackTextLength } from "@/lib/feedback-body";
import { invalidateFeedbackQueries, myFeedbackQueryOptions } from "@/lib/queries/feedback";
import { projectQueryOptions } from "@/lib/queries/projects";
import { roundBySlugQueryOptions } from "@/lib/queries/rounds";
import { useRoundJoinMutation } from "@/lib/round-join";
import { roundHref } from "@/lib/round-links";
import type { RoundDetail } from "@/lib/round-route";
import { useRoundViewer } from "@/lib/round-viewer";
import { cn } from "@/lib/utils";

type WidgetTab = "home" | "messages";
type SubmissionKind = "issue" | "feature";

const KIND_PREFIX: Record<SubmissionKind, string> = {
  issue: "**Issue**\n\n",
  feature: "**Feature request**\n\n",
};

interface FeedbackWidgetProps {
  /** Slug of the project whose latest open round receives the feedback. */
  projectSlug: string;
}

/** Bottom-right launcher that posts to a project's latest open round (#178). */
export function FeedbackWidget({ projectSlug }: FeedbackWidgetProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-3">
      {open && (
        <section
          aria-label="Feedback"
          data-testid="feedback-widget-panel"
          className="flex max-h-[min(36rem,calc(100dvh-6rem))] w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-lg sm:w-96"
        >
          <WidgetPanel projectSlug={projectSlug} onClose={() => setOpen(false)} />
        </section>
      )}
      <Button
        type="button"
        size="icon"
        className="h-12 w-12 rounded-full shadow-lg"
        aria-label={open ? "Close feedback" : "Give feedback"}
        aria-expanded={open}
        data-testid="feedback-widget-launcher"
        onClick={() => setOpen((value) => !value)}
      >
        {open ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
      </Button>
    </div>
  );
}

function WidgetPanel({ projectSlug, onClose }: { projectSlug: string; onClose: () => void }) {
  const apiClient = useApiClient();
  const project = useQuery(projectQueryOptions(apiClient, projectSlug));
  const latestOpen = project.data?.rounds
    .filter((r) => r.status === "open")
    .reduce<{ projectRoundNumber: number } | null>(
      (best, r) => (!best || r.projectRoundNumber > best.projectRoundNumber ? r : best),
      null,
    );
  const round = useQuery({
    ...roundBySlugQueryOptions(apiClient, projectSlug, latestOpen?.projectRoundNumber ?? 0),
    enabled: !!latestOpen,
  });

  let body: ReactNode;
  if (project.isLoading || (latestOpen && round.isLoading)) {
    body = <PanelSkeleton />;
  } else if (project.isError || !project.data) {
    body = (
      <State
        title="Feedback isn't available right now"
        hint="We couldn't load this project. Try again in a moment."
      />
    );
  } else if (!latestOpen) {
    body = (
      <State title="No open feedback round" hint="This project isn't collecting feedback yet.">
        <Button asChild size="sm" variant="outline">
          <Link to="/manage/new" onClick={onClose}>
            Request a round
          </Link>
        </Button>
      </State>
    );
  } else if (round.isError || !round.data) {
    body = (
      <State
        title="Feedback isn't available right now"
        hint="We couldn't load the latest round. Try again in a moment."
      />
    );
  } else {
    body = <RoundPanel round={round.data} onClose={onClose} />;
  }

  return (
    <>
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">Feedback</p>
          <p className="truncate text-xs text-muted-foreground">{project.data?.name ?? " "}</p>
        </div>
        <Button type="button" size="icon" variant="ghost" aria-label="Close" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </header>
      {body}
    </>
  );
}

function RoundPanel({ round, onClose }: { round: RoundDetail; onClose: () => void }) {
  const [tab, setTab] = useState<WidgetTab>("home");
  const viewer = useRoundViewer(round);
  const needsLegionCheck = round.legionOnly && viewer.cta.kind === "join";
  const { legionAccess } = useLegionAccess(needsLegionCheck);
  const legionBlocked = needsLegionCheck && legionAccess?.hasAccess !== true;
  const joinMutation = useRoundJoinMutation();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-border px-4 py-2">
        <SegmentedToggle<WidgetTab>
          ariaLabel="Feedback sections"
          value={tab}
          onValueChange={setTab}
          options={[
            { value: "home", label: "Home" },
            { value: "messages", label: "Messages" },
          ]}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {tab === "home" ? (
          <HomeTab
            round={round}
            viewer={viewer}
            legionBlocked={legionBlocked}
            legionMessage={needsLegionCheck ? legionAccess : undefined}
            joining={joinMutation.isPending}
            onJoin={() => joinMutation.mutate({ roundId: round.id, join: true })}
            onPosted={() => setTab("messages")}
            onNavigate={onClose}
          />
        ) : (
          <MessagesTab round={round} signedIn={!!viewer.accountId} />
        )}
      </div>
    </div>
  );
}

function HomeTab({
  round,
  viewer,
  legionBlocked,
  legionMessage,
  joining,
  onJoin,
  onPosted,
  onNavigate,
}: {
  round: RoundDetail;
  viewer: ReturnType<typeof useRoundViewer>;
  legionBlocked: boolean;
  legionMessage: ReturnType<typeof useLegionAccess>["legionAccess"];
  joining: boolean;
  onJoin: () => void;
  onPosted: () => void;
  onNavigate: () => void;
}) {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();
  const [kind, setKind] = useState<SubmissionKind>("issue");
  const [text, setText] = useState("");

  const post = useMutation({
    mutationFn: () =>
      apiClient.postFeedback({
        id: round.id,
        format: "written",
        body: `${KIND_PREFIX[kind]}${text.trim()}`,
      }),
    onSuccess: () => {
      void invalidateFeedbackQueries(queryClient, round.id);
      setText("");
      toast.success("Thanks, your feedback was sent");
      onPosted();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (!round.formats.includes("written")) {
    return (
      <State
        title="Written feedback is turned off"
        hint="This round only accepts other kinds of feedback."
      >
        <Button asChild size="sm" variant="outline">
          <Link to={roundHref(round)} onClick={onNavigate}>
            Open the round
          </Link>
        </Button>
      </State>
    );
  }

  if (viewer.isExpired) {
    return <State title="This round has ended" hint="It's no longer taking feedback." />;
  }

  const { cta } = viewer;

  if (cta.kind === "signin") {
    return (
      <State title="Sign in to send feedback" hint="Feedback is tied to your account.">
        <Button asChild size="sm">
          <Link to={cta.loginTo.to} search={cta.loginTo.search} onClick={onNavigate}>
            Sign in
          </Link>
        </Button>
      </State>
    );
  }

  if (cta.kind === "link-account") {
    return (
      <State
        title="Link a NEAR account"
        hint="Rounds identify testers by their NEAR account, so link one to send feedback."
      >
        <Button asChild size="sm">
          <Link to="/settings/auth-methods" onClick={onNavigate}>
            Link a NEAR account
          </Link>
        </Button>
      </State>
    );
  }

  if (cta.kind === "none" && !viewer.canPost) {
    return (
      <State
        title="You can't post on this round"
        hint="Round owners and managers reply to feedback from the round page."
      >
        <Button asChild size="sm" variant="outline">
          <Link to={roundHref(round)} onClick={onNavigate}>
            Open the round
          </Link>
        </Button>
      </State>
    );
  }

  if (cta.kind === "join") {
    return (
      <State
        title="Join the round to send feedback"
        hint={
          round.isPrivate
            ? "This round is private: only its team and you can read what you send."
            : "Joining adds you as a tester on this round."
        }
      >
        {legionMessage && !legionMessage.hasAccess && (
          <p className="text-xs text-muted-foreground" data-testid="feedback-widget-legion">
            This round is for Legion members.{" "}
            <a
              href={legionMessage.mintUrl}
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2"
            >
              Get a Legion SBT
            </a>
            {legionMessage.linkedNearAccount
              ? ` (${legionMessage.linkedNearAccount} doesn't hold one yet).`
              : "."}
          </p>
        )}
        <Button size="sm" onClick={onJoin} disabled={joining || legionBlocked}>
          Join round
        </Button>
      </State>
    );
  }

  const length = feedbackTextLength(text);
  const tooLong = length > FEEDBACK_TEXT_MAX;

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (text.trim() && !tooLong) post.mutate();
      }}
    >
      <p className="text-sm font-medium">How can we help?</p>
      <SegmentedToggle<SubmissionKind>
        ariaLabel="Type of feedback"
        value={kind}
        onValueChange={setKind}
        disabled={post.isPending}
        options={[
          { value: "issue", label: "Report an issue" },
          { value: "feature", label: "Request a feature" },
        ]}
      />
      <Textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder={kind === "issue" ? "What went wrong?" : "What would you like to see?"}
        rows={5}
        aria-label="Your feedback"
        disabled={post.isPending}
      />
      <div className="flex items-center justify-between gap-2">
        <span className={cn("text-xs text-muted-foreground", tooLong && "text-destructive")}>
          {length.toLocaleString()} / {FEEDBACK_TEXT_MAX.toLocaleString()}
        </span>
        <Button type="submit" size="sm" disabled={!text.trim() || tooLong || post.isPending}>
          {post.isPending ? "Sending…" : "Send"}
        </Button>
      </div>
    </form>
  );
}

function MessagesTab({ round, signedIn }: { round: RoundDetail; signedIn: boolean }) {
  const apiClient = useApiClient();
  const mine = useQuery({ ...myFeedbackQueryOptions(apiClient, round.id), enabled: signedIn });

  if (!signedIn) {
    return (
      <State
        title="Sign in to see your messages"
        hint="Your submissions and replies show up here."
      />
    );
  }
  if (mine.isLoading) return <PanelSkeleton />;
  if (mine.isError) {
    return <State title="Couldn't load your messages" hint="Try again in a moment." />;
  }
  if (!mine.data?.length) {
    return (
      <State title="Nothing sent yet" hint="Feedback you send on this round will show up here." />
    );
  }

  return (
    <ul className="flex flex-col gap-3" data-testid="feedback-widget-messages">
      {mine.data.map((item) => (
        <li key={item.id} className="rounded-md border border-border p-3">
          <p className="line-clamp-4 whitespace-pre-wrap text-sm">
            {plainText(item.body, item.url)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {new Date(item.createdAt).toLocaleDateString()} · {item.status}
          </p>
          {item.notes.length > 0 && (
            <ul className="mt-2 flex flex-col gap-2 border-t border-border pt-2">
              {item.notes.map((note) => (
                <li key={note.id} className="text-sm">
                  <span className="text-xs font-medium text-muted-foreground">
                    {note.role === "owner" ? "Reply from the team" : "You"}
                  </span>
                  <p className="whitespace-pre-wrap">{note.body}</p>
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}

function plainText(body: string | null, url: string | null): string {
  if (!body) return url ?? "";
  return body
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "[image]")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .trim();
}

function State({ title, hint, children }: { title: string; hint: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-2 p-4" data-testid="feedback-widget-state">
      <p className="text-sm font-medium">{title}</p>
      <p className="text-xs text-muted-foreground">{hint}</p>
      {children}
    </div>
  );
}

function PanelSkeleton() {
  return (
    <div className="flex flex-col gap-3 p-4">
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}
