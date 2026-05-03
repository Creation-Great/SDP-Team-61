import { Megaphone } from 'lucide-react';
import Card from '../ui/Card';
import Button from '../ui/Button';

/**
 * System Announcements creation panel.
 *
 * Props:
 *  - announcementTitle   {string}
 *  - setAnnouncementTitle {function}
 *  - announcementBody    {string}
 *  - setAnnouncementBody  {function}
 *  - announcementCourse  {string}
 *  - setAnnouncementCourse {function}
 *  - announcementGroup   {string}
 *  - setAnnouncementGroup  {function}
 *  - announcementLink    {string}
 *  - setAnnouncementLink   {function}
 *  - announcementSending {boolean}
 *  - announcementMsg     {string}
 *  - sendAnnouncement    {function}
 */
export default function AnnouncementsPanel({
  announcementTitle,
  setAnnouncementTitle,
  announcementBody,
  setAnnouncementBody,
  announcementCourse,
  setAnnouncementCourse,
  announcementGroup,
  setAnnouncementGroup,
  announcementLink,
  setAnnouncementLink,
  announcementSending,
  announcementMsg,
  sendAnnouncement,
}) {
  return (
    <Card className="p-6">
      <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
        <Megaphone className="w-5 h-5 text-[#000E2F]" />
        System Announcements
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <input
          type="text"
          className="px-3 py-2 rounded-xl border border-slate-200 text-sm"
          placeholder="Title"
          value={announcementTitle}
          onChange={(e) => setAnnouncementTitle(e.target.value)}
        />
        <input
          type="text"
          className="px-3 py-2 rounded-xl border border-slate-200 text-sm"
          placeholder="Link (optional), e.g. /peer-review"
          value={announcementLink}
          onChange={(e) => setAnnouncementLink(e.target.value)}
        />
        <input
          type="text"
          className="px-3 py-2 rounded-xl border border-slate-200 text-sm"
          placeholder="Course scope (optional)"
          value={announcementCourse}
          onChange={(e) => setAnnouncementCourse(e.target.value)}
        />
        <input
          type="text"
          className="px-3 py-2 rounded-xl border border-slate-200 text-sm"
          placeholder="Group scope (optional)"
          value={announcementGroup}
          onChange={(e) => setAnnouncementGroup(e.target.value)}
        />
      </div>
      <textarea
        className="mt-3 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm min-h-24"
        placeholder="Announcement content"
        value={announcementBody}
        onChange={(e) => setAnnouncementBody(e.target.value)}
      />
      <div className="mt-3 flex items-center gap-3">
        <Button onClick={sendAnnouncement} disabled={announcementSending}>
          {announcementSending ? 'Sending...' : 'Publish Announcement'}
        </Button>
        {announcementMsg ? <span className="text-sm text-slate-600">{announcementMsg}</span> : null}
      </div>
    </Card>
  );
}
