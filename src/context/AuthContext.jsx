import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  createUserWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth'
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  getDocs,
  limit,
  query,
  collection,
} from 'firebase/firestore'
import { auth, db, firebaseReady } from '../config/firebase'
import { TD, ROLES } from '../utils/constants'

const AuthContext = createContext(null)

// Up to N remembered profiles for the account-switcher dropdown. Stored as
// metadata (email + name + role) plus a paired credentials map keyed by
// email so a tester/dev on a shared QA machine can flip between accounts
// without retyping the password every time. The credentials live in a
// separate localStorage key so we can clear them independently if needed.
//
// Caveat: the credentials map is plain text in localStorage. That's the
// trade-off the team explicitly asked for here ("don't ask me password
// again") on an internal QA tool — not appropriate for a public-facing
// app. Forgetting a profile clears its stored credential.
const REMEMBERED_KEY = 'td_remembered_profiles'
const CREDS_KEY = 'td_remembered_credentials'
const REMEMBERED_LIMIT = 5

function loadRemembered() {
  try {
    const raw = localStorage.getItem(REMEMBERED_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((p) => p && p.email) : []
  } catch {
    return []
  }
}

function saveRemembered(list) {
  try {
    localStorage.setItem(REMEMBERED_KEY, JSON.stringify(list.slice(0, REMEMBERED_LIMIT)))
  } catch {
    // storage full / disabled — silently ignore
  }
}

function loadCreds() {
  try {
    const raw = localStorage.getItem(CREDS_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveCreds(map) {
  try {
    localStorage.setItem(CREDS_KEY, JSON.stringify(map))
  } catch {
    // ignore
  }
}

function rememberCredential(email, password) {
  const map = loadCreds()
  map[email.toLowerCase()] = password
  saveCreds(map)
}

function getRememberedCredential(email) {
  const map = loadCreds()
  return map[email.toLowerCase()] || null
}

function forgetCredential(email) {
  const map = loadCreds()
  delete map[email.toLowerCase()]
  saveCreds(map)
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [needsFirstTimeSetup, setNeedsFirstTimeSetup] = useState(false)
  const [rememberedProfiles, setRememberedProfiles] = useState(loadRemembered)

  useEffect(() => {
    if (!firebaseReady) {
      setLoading(false)
      return
    }
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        setUser(fbUser)
        const snap = await getDoc(doc(db, TD.users, fbUser.uid))
        if (snap.exists()) {
          const p = { uid: fbUser.uid, ...snap.data() }
          setProfile(p)
          rememberProfile(p)
        } else {
          setProfile(null)
        }
      } else {
        setUser(null)
        setProfile(null)
        // Check if there are any users at all — if not, enable first-time setup
        try {
          const q = query(collection(db, TD.users), limit(1))
          const existing = await getDocs(q)
          setNeedsFirstTimeSetup(existing.empty)
        } catch {
          setNeedsFirstTimeSetup(false)
        }
      }
      setLoading(false)
    })
    return () => unsub()
  }, [])

  // Remember a profile in the switcher list. Dedupes by email (case-insensitive)
  // and pushes the most recent to the front.
  function rememberProfile(p) {
    if (!p?.email) return
    setRememberedProfiles((curr) => {
      const email = p.email.toLowerCase()
      const next = [
        { email: p.email, name: p.name || '', role: p.role || '' },
        ...curr.filter((x) => x.email.toLowerCase() !== email),
      ].slice(0, REMEMBERED_LIMIT)
      saveRemembered(next)
      return next
    })
  }

  function forgetProfile(email) {
    setRememberedProfiles((curr) => {
      const next = curr.filter((x) => x.email.toLowerCase() !== email.toLowerCase())
      saveRemembered(next)
      return next
    })
    forgetCredential(email)
  }

  async function login(email, password) {
    await signInWithEmailAndPassword(auth, email, password)
    // Cache for quick switching later. Only happens after a successful
    // sign-in, so a wrong password is never persisted.
    rememberCredential(email, password)
  }

  async function logout() {
    await signOut(auth)
  }

  // Sign in directly as a remembered profile using the cached credential.
  // Returns { ok: true } if it worked, { ok: false, reason: 'no-credential' }
  // if we have no stored password (first-time switch), or
  // { ok: false, reason: 'auth', error } if the stored password no longer
  // works (changed remotely, account disabled, etc.) — caller should
  // route to /login?email=… as a fallback.
  async function switchToProfile(email) {
    const password = getRememberedCredential(email)
    if (!password) return { ok: false, reason: 'no-credential' }
    try {
      await signInWithEmailAndPassword(auth, email, password)
      return { ok: true }
    } catch (error) {
      // Stored password no longer valid — drop it so the user gets the
      // password prompt next time instead of failing again silently.
      forgetCredential(email)
      return { ok: false, reason: 'auth', error }
    }
  }

  function hasCredentialFor(email) {
    return !!getRememberedCredential(email)
  }

  async function createFirstDeveloper({ name, email, password }) {
    const cred = await createUserWithEmailAndPassword(auth, email, password)
    await updateProfile(cred.user, { displayName: name })
    await setDoc(doc(db, TD.users, cred.user.uid), {
      uid: cred.user.uid,
      name,
      email,
      role: ROLES.DEVELOPER,
      avatar: '',
      createdAt: serverTimestamp(),
    })
    rememberCredential(email, password)
    setNeedsFirstTimeSetup(false)
  }

  const value = useMemo(
    () => ({
      user,
      profile,
      role: profile?.role ?? null,
      loading,
      needsFirstTimeSetup,
      firebaseReady,
      login,
      logout,
      createFirstDeveloper,
      rememberedProfiles,
      forgetProfile,
      switchToProfile,
      hasCredentialFor,
    }),
    [user, profile, loading, needsFirstTimeSetup, rememberedProfiles]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
