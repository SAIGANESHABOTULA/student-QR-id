import { lazy, Suspense } from 'react'
import { Link, Route, Routes } from 'react-router-dom'
import { AdminLayout, PublicLayout } from './components/Layouts'
import { Spinner } from './components/ui'
import Landing from './pages/Landing'

const Verify = lazy(() => import('./pages/Verify'))
const Login = lazy(() => import('./pages/Login'))
const Dashboard = lazy(() => import('./pages/admin/Dashboard'))
const Students = lazy(() => import('./pages/admin/Students'))
const StudentDetail = lazy(() => import('./pages/admin/StudentDetail'))
const Scans = lazy(() => import('./pages/admin/Scans'))

const Fallback = () => <div className="grid min-h-[50vh] place-items-center"><Spinner className="size-8 text-brand-500" /></div>

export default function App() {
  return (
    <Suspense fallback={<Fallback />}>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route index element={<Landing />} />
          <Route path="verify" element={<Verify />} />
          <Route path="*" element={<NotFound />} />
        </Route>
        <Route path="login" element={<Login />} />
        <Route path="admin" element={<AdminLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="students" element={<Students />} />
          <Route path="students/:id" element={<StudentDetail />} />
          <Route path="scans" element={<Scans />} />
        </Route>
      </Routes>
    </Suspense>
  )
}

function NotFound() {
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <p className="font-display text-7xl font-bold text-brand-600">404</p>
      <p className="mt-3 text-slate-600 dark:text-slate-400">This page doesn't exist.</p>
      <Link to="/" className="btn-primary mt-6">Go home</Link>
    </div>
  )
}
