/**
 * Service Worker — ทำให้แอพเปิดได้ทันทีแม้ไม่มีสัญญาณ
 *
 * กลยุทธ์: stale-while-revalidate เฉพาะไฟล์หน้าจอ
 *   1. เสิร์ฟจากแคชทันที (เปิดแอพไม่ต้องรอเน็ตเลย)
 *   2. แล้วค่อยโหลดตัวใหม่มาเก็บเงียบ ๆ — รอบเปิดถัดไปจะได้ของใหม่
 *
 * การเรียก API ไปที่ Apps Script เป็น POST จึงไม่ถูกแคชอยู่แล้ว
 * (ข้อมูลจากชีทต้องสดเสมอ ห้ามแคช)
 */

const VERSION = 'v21';
const SHELL_CACHE = 'ppr-shell-' + VERSION;
const FONT_CACHE  = 'ppr-font-' + VERSION;

const SHELL = [
  './index.html',
  './admin.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (e) => {
  // เก็บทีละไฟล์ ไม่ใช้ addAll เพราะถ้าไฟล์เดียวโหลดไม่ได้ addAll จะล้มทั้งชุด
  // แล้ว Service Worker จะติดตั้งไม่สำเร็จเลย
  e.waitUntil(
    caches.open(SHELL_CACHE)
      .then((c) => Promise.all(
        SHELL.map((u) => c.add(u).catch(() => { /* ข้ามไฟล์ที่โหลดไม่ได้ */ }))
      ))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== SHELL_CACHE && k !== FONT_CACHE)
            .map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;

  // ปล่อยผ่านทุกอย่างที่ไม่ใช่ GET — โดยเฉพาะ POST ที่ยิงไป Apps Script
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // ฟอนต์จาก Google — เก็บไว้ใช้ตอนออฟไลน์ (cache-first เพราะไม่เคยเปลี่ยน)
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(
      caches.open(FONT_CACHE).then((c) =>
        c.match(req).then((hit) =>
          hit || fetch(req).then((res) => { c.put(req, res.clone()); return res; })
                           .catch(() => hit)
        )
      )
    );
    return;
  }

  // ไฟล์ของเราเอง — เสิร์ฟจากแคชก่อน แล้วอัปเดตเบื้องหลัง
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.open(SHELL_CACHE).then((c) =>
        c.match(req, { ignoreSearch: true }).then((hit) => {
          const fresh = fetch(req)
            .then((res) => { if (res && res.ok) c.put(req, res.clone()); return res; })
            .catch(() => hit);
          return hit || fresh;
        })
      )
    );
  }
});
