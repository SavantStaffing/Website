import { createFileRoute } from "@tanstack/react-router";
import { GettingStarted } from "@/components/site/GettingStarted";

export const Route = createFileRoute("/recruiter/welcome")({
  head: () => ({
    meta: [{ title: "Getting started" }, { name: "robots", content: "noindex" }],
  }),
  component: RecruiterWelcome,
});

function RecruiterWelcome() {
  return (
    <GettingStarted
      eyebrow="Recruiter hub"
      title="Welcome to Savant."
      intro={
        <p>
          Savant connects you with job seekers who've built a full profile, and with employers we've
          checked for fair pay and how they treat their people. Here's how the main work gets done.
        </p>
      }
      steps={[
        {
          title: "Set up your company",
          where: "Company",
          body: (
            <p>
              Add your company's details first. Your job postings and invitations carry its name, so
              talent know who they're hearing from.
            </p>
          ),
          links: [{ label: "Company info", to: "/recruiter/company" }],
        },
        {
          title: "Post jobs",
          where: "Jobs",
          body: (
            <>
              <p>
                Click <strong>Post a job</strong> and fill in the role, location, pay and type. It
                goes into Savant's job feed, where talent can find it and apply.
              </p>
              <p>
                Your organization's postings are listed on the same page. Applications arrive under{" "}
                <strong>Applications</strong>.
              </p>
            </>
          ),
          links: [
            { label: "Post a job", to: "/recruiter/jobs" },
            { label: "Applications", to: "/recruiter/applications" },
          ],
        },
        {
          title: "Find talent",
          where: "Talent Feed",
          body: (
            <>
              <p>
                Search talent who have made their profile visible to recruiters, by skills, title,
                name or location. <strong>Save</strong> anyone you want to come back to; they're
                kept under Saved Talent.
              </p>
              <p>
                <strong>Assigned Talent</strong> lists people Savant's team has matched to you, with
                their résumé and contact details.
              </p>
            </>
          ),
          links: [
            { label: "Talent Feed", to: "/recruiter/talent" },
            { label: "Saved Talent", to: "/recruiter/saved" },
            { label: "Assigned Talent", to: "/recruiter/assigned" },
          ],
        },
        {
          title: "Request résumés and applications",
          where: "Talent Feed · Chat",
          body: (
            <>
              <p>
                On a talent card, click <strong>Request application</strong>, choose one of your
                open roles and <strong>Send invitation</strong>. They're notified in their Inbox;
                their email and phone are shared with you once they accept.
              </p>
              <p>
                To ask for a résumé directly, message them in <strong>Chat</strong>. They can reply
                with the file attached. Résumés of talent assigned to you are already on Assigned
                Talent.
              </p>
            </>
          ),
          links: [
            { label: "Talent Feed", to: "/recruiter/talent" },
            { label: "Chat", to: "/recruiter/chat" },
          ],
        },
        {
          title: "Schedule interviews",
          where: "Applications · Talent & Schedule",
          body: (
            <>
              <p>
                In <strong>Applications</strong>, move a candidate through Reviewed and{" "}
                <strong>Interviewing</strong>. On <strong>Talent &amp; Schedule</strong>, pick a
                time for anyone marked Interviewing, or schedule an interview directly. The
                candidate is notified with the date and time.
              </p>
              <p>The same page tracks the invitations you've sent and who has replied.</p>
            </>
          ),
          links: [
            { label: "Applications", to: "/recruiter/applications" },
            { label: "Talent & Schedule", to: "/recruiter/schedule" },
          ],
        },
        {
          title: "Request documents",
          where: "Chat",
          body: (
            <>
              <p>
                Message the candidate in <strong>Chat</strong> with what you need, such as
                certifications, references or proof of work authorization. They reply with the files
                attached: PDF, Word, Excel, text or images, up to 10 MB each. Only the two of you
                can open them.
              </p>
              <p>
                Don't collect Social Security numbers, bank details or ID scans in chat. Use your
                company's secure onboarding system for those.
              </p>
            </>
          ),
          links: [{ label: "Open Chat", to: "/recruiter/chat" }],
        },
      ]}
      notes={[
        {
          q: "Who can I message?",
          a: "Talent who are visible to recruiters, and talent assigned to you. Talent can reply once you've written first, and Savant's team can message you at any time.",
        },
        {
          q: "Where do updates show up?",
          a: "In your Inbox: new applications, replies to invitations and new chat messages.",
        },
        {
          q: "Need help?",
          a: "Message the Savant team from Chat whenever they've written to you, or use the contact page.",
        },
      ]}
    />
  );
}
