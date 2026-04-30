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
// just metadata (email + name + role) — never passwords. Used to populate
// "Switch profile" so the dev/tester can flip between accounts on the same
// browser without retyping the email each time.
const REMEMBERED_KEY = 'td_remembered_profiles'
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
  }

  async function login(email, password) {
    await signInWithEmailAndPassword(auth, email, password)
  }

  async function logout() {
    await signOut(auth)
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
