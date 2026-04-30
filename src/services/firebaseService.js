import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  writeBatch,
  increment,
  Timestamp,
} from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { db, storage } from '../config/firebase'
import { TD, TESTCASE_STATUS, BUG_STATUS } from '../utils/constants'

/* ───────────────────────── Users ───────────────────────── */
export async function getUser(uid) {
  const snap = await getDoc(doc(db, TD.users, uid))
  return snap.exists() ? { uid, ...snap.data() } : null
}

export async function listUsers(role) {
  const q = role
    ? query(collection(db, TD.users), where('role', '==', role))
    : collection(db, TD.users)
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() }))
}

export async function listTesters() {
  return listUsers('tester')
}

export async function createUserDoc(uid, data) {
  await setDoc(doc(db, TD.users, uid), {
    ...data,
    uid,
    createdAt: serverTimestamp(),
  })
}

/* ───────────────────────── Projects ───────────────────────── */
export async function listProjects() {
  const snap = await getDocs(query(collection(db, TD.projects), orderBy('createdAt', 'desc')))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export async function createProject({ name, description, code, createdBy }) {
  const docRef = await addDoc(collection(db, TD.projects), {
    name,
    description: description || '',
    code: code || name.slice(0, 3).toUpperCase(),
    createdBy,
    createdAt: serverTimestamp(),
  })
  return docRef.id
}

export async function updateProject(id, data) {
  await updateDoc(doc(db, TD.projects, id), data)
}

// Shared error logger for onSnapshot — without one, listener errors (most
// commonly a missing composite index) are silently swallowed and the UI
// just shows empty state. Logging surfaces the FAILED_PRECONDITION link
// the SDK emits, which deep-links to "create this index" in the console.
function snapshotError(label) {
  return (err) => {
    // eslint-disable-next-line no-console
    console.error(`[firebaseService] ${label} listener failed:`, err.code, err.message)
  }
}

export function watchProjects(cb) {
  return onSnapshot(
    query(collection(db, TD.projects), orderBy('createdAt', 'desc')),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    snapshotError('watchProjects')
  )
}

/* ───────────────────────── Rounds ───────────────────────── */
export async function createRound(data) {
  const docRef = await addDoc(collection(db, TD.rounds), {
    ...data,
    createdAt: serverTimestamp(),
  })
  return docRef.id
}

export async function getRound(roundId) {
  const snap = await getDoc(doc(db, TD.rounds, roundId))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

export async function listRounds(projectId) {
  const q = projectId
    ? query(collection(db, TD.rounds), where('projectId', '==', projectId), orderBy('createdAt', 'desc'))
    : query(collection(db, TD.rounds), orderBy('createdAt', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export function watchRounds(projectId, cb) {
  const q = projectId
    ? query(collection(db, TD.rounds), where('projectId', '==', projectId), orderBy('createdAt', 'desc'))
    : query(collection(db, TD.rounds), orderBy('createdAt', 'desc'))
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    snapshotError('watchRounds')
  )
}

export async function updateRound(roundId, patch) {
  await updateDoc(doc(db, TD.rounds, roundId), patch)
}

/**
 * Delete a round and all docs that depend on it:
 * test cases, batches, bugs, and the comments on those bugs.
 * Chunked into 400-op batches to stay under Firestore's 500-write limit.
 * Storage files (screenshots) are left behind — delete manually if needed.
 */
export async function deleteRoundCascade(roundId) {
  const [tcSnap, batchSnap, bugSnap] = await Promise.all([
    getDocs(query(collection(db, TD.testcases), where('roundId', '==', roundId))),
    getDocs(query(collection(db, TD.batches), where('roundId', '==', roundId))),
    getDocs(query(collection(db, TD.bugs), where('roundId', '==', roundId))),
  ])

  const bugIds = bugSnap.docs.map((d) => d.id)
  let commentDocs = []
  // Firestore 'in' queries cap at 30 values — chunk if needed.
  for (let i = 0; i < bugIds.length; i += 30) {
    const slice = bugIds.slice(i, i + 30)
    if (!slice.length) continue
    const commentSnap = await getDocs(
      query(collection(db, TD.comments), where('bugId', 'in', slice))
    )
    commentDocs = commentDocs.concat(commentSnap.docs)
  }

  const allRefs = [
    ...tcSnap.docs.map((d) => d.ref),
    ...batchSnap.docs.map((d) => d.ref),
    ...bugSnap.docs.map((d) => d.ref),
    ...commentDocs.map((d) => d.ref),
    doc(db, TD.rounds, roundId),
  ]

  const CHUNK = 400
  for (let i = 0; i < allRefs.length; i += CHUNK) {
    const b = writeBatch(db)
    allRefs.slice(i, i + CHUNK).forEach((ref) => b.delete(ref))
    await b.commit()
  }

  return {
    testCases: tcSnap.size,
    batches: batchSnap.size,
    bugs: bugSnap.size,
    comments: commentDocs.length,
  }
}

export async function incrementRoundCounts(roundId, { passed = 0, failed = 0, pending = 0 } = {}) {
  const patch = {}
  if (passed) patch.passed = increment(passed)
  if (failed) patch.failed = increment(failed)
  if (pending) patch.pending = increment(pending)
  if (Object.keys(patch).length) await updateDoc(doc(db, TD.rounds, roundId), patch)
}

/* ───────────────────────── Test cases ───────────────────────── */
export async function bulkInsertTestCases(testCases) {
  if (!testCases.length) return []
  const batch = writeBatch(db)
  const ids = []
  for (const tc of testCases) {
    const ref = doc(collection(db, TD.testcases))
    batch.set(ref, { ...tc, createdAt: serverTimestamp() })
    ids.push(ref.id)
  }
  await batch.commit()
  return ids
}

export function watchTestCasesForRound(roundId, cb) {
  const q = query(collection(db, TD.testcases), where('roundId', '==', roundId))
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    snapshotError('watchTestCasesForRound')
  )
}

export async function listTestCasesForRound(roundId) {
  const q = query(collection(db, TD.testcases), where('roundId', '==', roundId))
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export async function listTestCasesForBatch(roundId, batchDate) {
  const q = query(
    collection(db, TD.testcases),
    where('roundId', '==', roundId),
    where('batchDate', '==', batchDate)
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export async function updateTestCase(id, patch) {
  await updateDoc(doc(db, TD.testcases, id), { ...patch, updatedAt: serverTimestamp() })
}

export async function getTestCase(id) {
  const snap = await getDoc(doc(db, TD.testcases, id))
  return snap.exists() ? { id, ...snap.data() } : null
}

/* ───────────────────────── Bugs ───────────────────────── */
export async function createBug(data) {
  const ref = await addDoc(collection(db, TD.bugs), {
    ...data,
    status: data.status || BUG_STATUS.OPEN,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

export async function getBug(id) {
  const snap = await getDoc(doc(db, TD.bugs, id))
  return snap.exists() ? { id, ...snap.data() } : null
}

export function watchBug(id, cb) {
  return onSnapshot(
    doc(db, TD.bugs, id),
    (snap) => {
      if (snap.exists()) cb({ id: snap.id, ...snap.data() })
    },
    snapshotError('watchBug')
  )
}

export async function updateBug(id, patch) {
  await updateDoc(doc(db, TD.bugs, id), { ...patch, updatedAt: serverTimestamp() })
}

export function watchBugs({ projectId, roundId, status, reporter, limitCount = 100 }, cb) {
  const clauses = []
  if (projectId) clauses.push(where('projectId', '==', projectId))
  if (roundId) clauses.push(where('roundId', '==', roundId))
  if (status) clauses.push(where('status', '==', status))
  if (reporter) clauses.push(where('reportedBy', '==', reporter))
  // Sort client-side to avoid needing a composite index for every combination
  // of (projectId, reporter, status, ...) + createdAt. Practical up to a few
  // hundred bugs per project.
  const q = query(collection(db, TD.bugs), ...clauses, limit(limitCount))
  return onSnapshot(
    q,
    (snap) => {
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      docs.sort((a, b) => {
        const ta = a.createdAt?.toMillis?.() || 0
        const tb = b.createdAt?.toMillis?.() || 0
        return tb - ta
      })
      cb(docs)
    },
    snapshotError('watchBugs')
  )
}

export async function countBugsForProject(projectId) {
  const q = query(collection(db, TD.bugs), where('projectId', '==', projectId))
  const snap = await getDocs(q)
  return snap.size
}

/* ───────────────────────── Comments ───────────────────────── */
export async function addComment(bugId, { userId, userName, userRole, message, attachments = [], projectId = null }) {
  await addDoc(collection(db, TD.comments), {
    bugId,
    projectId,
    userId,
    userName,
    userRole,
    message,
    attachments,
    createdAt: serverTimestamp(),
  })
}

export function watchComments(bugId, cb) {
  const q = query(collection(db, TD.comments), where('bugId', '==', bugId), orderBy('createdAt', 'asc'))
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    snapshotError('watchComments')
  )
}

/**
 * Watch the most recent comments across the whole comments collection.
 * Used by the notifications bell. Filtering by project / user is done
 * client-side in the consumer, so we don't need a composite index.
 */
export function watchRecentComments(cb, limitCount = 30) {
  const q = query(
    collection(db, TD.comments),
    orderBy('createdAt', 'desc'),
    limit(limitCount)
  )
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    snapshotError('watchRecentComments')
  )
}

/* ───────────────────────── Batches ───────────────────────── */
export async function bulkInsertBatches(batches) {
  if (!batches.length) return []
  const batch = writeBatch(db)
  const ids = []
  for (const b of batches) {
    const ref = doc(collection(db, TD.batches))
    batch.set(ref, b)
    ids.push(ref.id)
  }
  await batch.commit()
  return ids
}

export async function listBatchesForRound(roundId) {
  const q = query(collection(db, TD.batches), where('roundId', '==', roundId), orderBy('dayNumber', 'asc'))
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export async function updateBatch(id, patch) {
  await updateDoc(doc(db, TD.batches, id), patch)
}

/* ───────────────────────── Storage (screenshots) ───────────────────────── */
export async function uploadScreenshot(path, file) {
  const storageRef = ref(storage, path)
  await uploadBytes(storageRef, file)
  return getDownloadURL(storageRef)
}

export async function deleteScreenshot(path) {
  try {
    await deleteObject(ref(storage, path))
  } catch {
    // ignore
  }
}

export { serverTimestamp, Timestamp }
