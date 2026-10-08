import { createFileRoute } from "@tanstack/react-router";
import { GettingStarted } from "@/components/site/GettingStarted";

export const Route = createFileRoute("/coach/welcome")({
  head: () => ({
    meta: [{ title: "Getting started" }, { name: "robots", content: "noindex" }],
  }),
  component: CoachWelcome,
});

function CoachWelcome() {
  return (
    <GettingStarted
      eyebrow="Coach hub"
      title="Welcome to Savant."
      intro={
        <p>
          As a Savant career coach you work one-on-one with talent on their résumé, interviews, job
          fairs and career programs. Every career program runs with a coach. Here's how the work
          flows through your hub.
        </p>
      }
      steps={[
        {
          title: "Pick up service requests",
          where: "Service Requests",
          body: (
            <p>
              When talent sign up for Resume Building, Interview Development, Job Fairs or a career
              program, Savant's team assigns the request to a coach. Yours are listed under{" "}
              <strong>Service Requests</strong>; click <strong>Start</strong> to begin.
            </p>
          ),
          links: [{ label: "Service Requests", to: "/coach" }],
        },
        {
          title: "Find talent to coach",
          where: "Talent",
          body: (
            <>
              <p>
                Under <strong>Find talent to coach</strong>, browse talent and click{" "}
                <strong>Request to coach</strong>. Once Savant's team approves, they move to{" "}
                <strong>Your talent</strong>, with their profile, résumé and contact details.
              </p>
            </>
          ),
          links: [{ label: "Talent", to: "/coach/talent" }],
        },
        {
          title: "Schedule sessions",
          where: "Talent & Schedule",
          body: (
            <p>
              Set a date and time for each person you're working with. They're notified in their
              Inbox, and the page shows who still needs a session.
            </p>
          ),
          links: [{ label: "Talent & Schedule", to: "/coach/schedule" }],
        },
        {
          title: "Work on résumés",
          where: "Talent · Chat",
          body: (
            <>
              <p>
                Savant résumés build on Yale University's résumé template, structured to pass the
                applicant tracking systems most employers use to screen applications.
              </p>
              <p>
                Ask for the latest version in <strong>Chat</strong>; talent can reply with the file
                attached, and you can send drafts back the same way (PDF or Word, up to 10 MB).
              </p>
            </>
          ),
          links: [
            { label: "Your talent", to: "/coach/talent" },
            { label: "Chat", to: "/coach/chat" },
          ],
        },
        {
          title: "Send jobs to your talent",
          where: "Jobs",
          body: (
            <p>
              Open a job and click <strong>Send to talent</strong> to share it with the people
              you're coaching. It arrives in their Inbox. The <strong>Recruiters</strong> page lists
              the recruiters and companies hiring on Savant.
            </p>
          ),
          links: [
            { label: "Jobs", to: "/jobs" },
            { label: "Recruiters", to: "/coach/recruiters" },
          ],
        },
        {
          title: "Keep in touch",
          where: "Chat · Inbox",
          body: (
            <p>
              Message any talent from <strong>Chat</strong>, and they can message you. New requests,
              approvals and messages show up in your <strong>Inbox</strong>.
            </p>
          ),
          links: [
            { label: "Chat", to: "/coach/chat" },
            { label: "Inbox", to: "/coach/inbox" },
          ],
        },
      ]}
      notes={[
        {
          q: "Who can I message?",
          a: "Any talent on Savant. Recruiters and other coaches aren't reachable from Chat; Savant's team can message you at any time.",
        },
        {
          q: "Documents in chat",
          a: "Attachments are private to you and the person you're chatting with. Don't collect Social Security numbers, bank details or ID scans in chat.",
        },
      ]}
    />
  );
}
