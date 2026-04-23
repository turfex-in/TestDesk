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

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [needsFirstTimeSetup, setNeedsFirstTimeSetup] = useState(false)

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
          setProfile({ uid: fbUser.uid, ...snap.data() })
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
    }),
    [user, profile, loading, needsFirstTimeSetup]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
