/*
 * E-ticket PDF with a signed QR code. Made in the browser (jsPDF), so the ticket works offline once saved.
 * The QR holds a link to this app's /verify page with a code the server signed: a ticket checker scans it
 * and sees the live status. A changed or made-up code shows as not valid.
 */
import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { customerApi, quotaOf, SEAT_TYPES } from './api.js';
import { passengerStatus } from './pages/customer/Ticket.jsx';

const NAVY = [27, 58, 115];
const ORANGE = [244, 123, 32];
const INK = [28, 36, 48];
const GREY = [93, 104, 120];

/** jsPDF's built-in fonts have no rupee sign */
const rs = (n) => `Rs. ${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;

export async function downloadETicket(token, b) {
  const [codeRes, ttRes] = await Promise.all([
    customerApi.ticketCode(token, b.bookingId),
    customerApi.timetable(b.trainNumber).catch(() => null),
  ]);
  const verifyUrl = `${window.location.origin}/ticket-check?code=${encodeURIComponent(codeRes.data2)}`;
  const qr = await QRCode.toDataURL(verifyUrl, { errorCorrectionLevel: 'M', margin: 1, width: 360 });

  const stops = ttRes?.data2?.stops || [];
  const board = stops[b.fromStop];
  const alight = stops[b.toStop];
  const boarding = new Date((b.boardingDate || b.journeyDate) + 'T00:00');
  const arrival = new Date(boarding);
  if (board && alight) arrival.setDate(arrival.getDate() + (alight.day - board.day));
  const day = (d) => d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  const cls = SEAT_TYPES.find((t) => t.id === b.seatType);
  const quota = b.quota || 'GN';

  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const M = 40;

  // Header band
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, W, 64, 'F');
  doc.setFillColor(...ORANGE);
  doc.rect(0, 64, W, 4, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('Railway', M, 40);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('Electronic Reservation Slip (e-ticket)', W - M, 40, { align: 'right' });

  // PNR and status
  let y = 100;
  doc.setTextColor(...GREY);
  doc.setFontSize(9);
  doc.text('PNR', M, y);
  doc.text('Booking status', M + 170, y);
  doc.setTextColor(...INK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text(String(b.bookingId), M, y + 24);
  doc.setFontSize(13);
  doc.text(String(b.status).replace('_', ' '), M + 170, y + 22);

  // QR on the right
  const Q = 120;
  doc.addImage(qr, 'PNG', W - M - Q, 84, Q, Q);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...GREY);
  doc.text('Scan to verify this ticket', W - M - Q / 2, 84 + Q + 10, { align: 'center' });

  // Journey
  y = 160;
  doc.setTextColor(...INK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(`${b.trainNumber} ${b.trainName || ''}`, M, y);
  y += 26;
  doc.setFontSize(18);
  doc.text(board?.departs || '', M, y);
  doc.text(alight?.arrives || '', M + 230, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(b.fromStation, M, y + 15);
  doc.text(b.toStation, M + 230, y + 15);
  doc.setTextColor(...GREY);
  doc.text(day(boarding), M, y + 29);
  doc.text(day(arrival), M + 230, y + 29);
  doc.text('->', M + 165, y - 4);

  // Details grid
  y += 56;
  const cell = (label, value, x) => {
    doc.setFontSize(8);
    doc.setTextColor(...GREY);
    doc.text(label, x, y);
    doc.setFontSize(10);
    doc.setTextColor(...INK);
    doc.text(String(value ?? ''), x, y + 13);
  };
  cell('Class', cls ? `${cls.label} (${cls.short})` : b.seatType, M);
  cell('Quota', quotaOf(quota).label, M + 150);
  cell('Distance', `${Math.round(b.distanceKm || 0)} km`, M + 280);
  cell('Total fare', rs(b.totalFare), M + 380);
  y += 30;
  cell('Booked on', b.bookedAt ? new Date(b.bookedAt).toLocaleString('en-IN') : '', M);
  if (b.refundAmount > 0) cell('Refunded', rs(b.refundAmount), M + 280);
  if (b.paymentId) cell('Payment', b.paymentId, M + 150);

  // Passengers
  y += 40;
  doc.setFillColor(242, 244, 248);
  doc.rect(M, y - 13, W - 2 * M, 20, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...INK);
  const cols = [M + 6, M + 26, M + 210, M + 245, M + 300];
  ['#', 'Name', 'Age', 'Gender', 'Current status'].forEach((h, i) => doc.text(h, cols[i], y));
  doc.setFont('helvetica', 'normal');
  b.passengers.forEach((p, i) => {
    y += 20;
    doc.text(String(i + 1), cols[0], y);
    doc.text(p.name, cols[1], y);
    doc.text(String(p.age), cols[2], y);
    doc.text(p.gender || '', cols[3], y);
    doc.text(passengerStatus(p, quota), cols[4], y);
    doc.setDrawColor(230, 234, 241);
    doc.line(M, y + 6, W - M, y + 6);
  });

  if (b.note) {
    y += 28;
    doc.setFontSize(9);
    doc.setTextColor(...INK);
    doc.text(doc.splitTextToSize(b.note, W - 2 * M), M, y);
  }

  // Instructions
  y += 36;
  doc.setFontSize(8.5);
  doc.setTextColor(...GREY);
  const notes = [
    'Carry a photo ID (Aadhaar, PAN, driving licence, passport or voter ID) that matches a passenger on this ticket.',
    'Waitlisted passengers who are not confirmed when the chart is prepared do not travel. RAC passengers share a side-lower berth.',
    'Check the live status by scanning the QR code, or on the PNR status page.',
  ];
  notes.forEach((n) => {
    doc.text(doc.splitTextToSize(`- ${n}`, W - 2 * M), M, y);
    y += 14;
  });

  doc.save(`e-ticket-${b.bookingId}.pdf`);
}
