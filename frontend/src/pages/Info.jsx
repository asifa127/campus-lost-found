import { Mail, Phone } from 'lucide-react';
import { PublicFooter, PublicHeader } from '../components/PublicChrome';
import { useAppSettings } from '../hooks/hooks';
import { ButtonLink } from '../components/ui';

const H = ({ children }) => <h2 className="mb-3 mt-10 text-lg font-semibold tracking-tight first:mt-0">{children}</h2>;
const P = ({ children }) => <p className="leading-relaxed text-muted-foreground">{children}</p>;
const List = ({ items }) => <ul className="list-disc space-y-2 pl-5 leading-relaxed text-muted-foreground marker:text-foreground/40">{items.map((i) => <li key={i}>{i}</li>)}</ul>;

function About({ appName, institutionName }) {
  return (
    <>
      <P>{appName} is a project built for {institutionName || 'the campus'}. It gives students and staff one place to report lost and found belongings, find likely matches and return items to their owners.</P>
      <H>How it works</H>
      <List items={[
        'Anyone can report a lost or found item with a photo and a few details.',
        'The Smart Matching Algorithm compares every new report with open reports from the other side and scores each pair out of 100. It is a transparent set of rules, not a trained AI model.',
        'A claim is reviewed by staff, who compare the answers with private details only the finder and staff can see.',
        'After approval, staff schedule a handover and the item is marked as recovered.',
      ]} />
      <H>Built with</H>
      <P>React, Node.js, Express and MongoDB, with JWT authentication.</P>
    </>
  );
}

function Contact({ contactEmail, supportContact, institutionName }) {
  const empty = !contactEmail && !supportContact;
  return (
    <>
      <P>Need help with a report or a claim? Reach the campus support team{institutionName ? ` at ${institutionName}` : ''}.</P>
      {empty ? (
        <p className="mt-6 rounded-md border border-border bg-muted/40 p-4 text-sm text-muted-foreground">Contact details have not been added yet. An administrator can set them under Settings.</p>
      ) : (
        <ul className="mt-6 divide-y divide-border rounded-md border border-border">
          {contactEmail && <li className="flex items-center gap-3 p-4"><Mail className="size-4 text-muted-foreground" aria-hidden /><div><p className="eyebrow">Email</p><a className="font-medium underline-offset-4 hover:underline" href={`mailto:${contactEmail}`}>{contactEmail}</a></div></li>}
          {supportContact && <li className="flex items-center gap-3 p-4"><Phone className="size-4 text-muted-foreground" aria-hidden /><div><p className="eyebrow">Support</p><p className="font-medium">{supportContact}</p></div></li>}
        </ul>
      )}
      <H>Found something?</H>
      <P>Report it on the site first, then hand the item to campus staff. It is held safely until the owner&apos;s claim has been verified.</P>
    </>
  );
}

const Privacy = () => (
  <>
    <P>This is a student project, so please do not upload photos of sensitive documents. Here is what the application does with your data.</P>
    <H>What is stored</H>
    <List items={[
      'Account details: name, email, student or staff ID, phone, department and year.',
      'Reports, claims, photos and messages you create.',
      'A log of important actions (for example logins, claim decisions and role changes) that administrators can review.',
    ]} />
    <H>What other people can see</H>
    <List items={[
      'Your name and department appear on reports you create. Your phone number and email are never shown to other students; use in-app messages to talk.',
      'Private identifying details on a report are visible only to you and campus staff, who use them to verify ownership.',
    ]} />
    <H>How it is protected</H>
    <List items={[
      'Passwords are hashed with bcrypt and never stored or returned in plain text.',
      'Every request is checked on the server for a valid session and the right role.',
      'Uploads are limited to JPG, PNG and WEBP images under 5 MB and are checked on the server.',
    ]} />
    <H>Your data</H>
    <P>Your information is used only to run the lost and found service. It is not sold or shared. To have your account and reports removed, contact an administrator.</P>
  </>
);

const Terms = () => (
  <>
    <P>By using this service you agree to the points below.</P>
    <List items={[
      'Report items truthfully. Fake reports, spam and fraudulent claims are not allowed and may lead to a blocked account.',
      'Only claim items that really belong to you. Staff decide each claim after checking your answers.',
      'Do not post offensive or illegal content. Administrators can remove reports and block accounts that break these rules.',
      'Handing items over is arranged by campus staff. The service is a coordination tool and cannot guarantee that an item will be found.',
      'The service is provided as a student project, as is, without warranty.',
    ]} />
  </>
);

const PAGES = { about: ['About', About], contact: ['Contact', Contact], privacy: ['Privacy', Privacy], terms: ['Terms', Terms] };

export default function Info({ page }) {
  const settings = useAppSettings();
  const [title, Body] = PAGES[page];
  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />
      <main id="main" className="mx-auto w-full max-w-3xl px-6 py-16 md:px-10 md:py-24">
        <h1 className="enter mb-8 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
        <div className="enter" style={{ animationDelay: '80ms' }}><Body {...settings} /></div>
        <div className="mt-12"><ButtonLink to="/" variant="secondary">Back to home</ButtonLink></div>
      </main>
      <PublicFooter />
    </div>
  );
}
