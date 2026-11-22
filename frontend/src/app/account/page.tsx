'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  User, Package, MapPin, Settings, LogOut,
  ArrowRight, Plus, Trash2, CheckCircle, AlertCircle,
  Phone, Mail, Edit3, Shield,
} from 'lucide-react'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { api } from '@/lib/api'
import { useAuthStore } from '@/lib/store'
import { Address } from '@/types'
import { toast } from 'sonner'

interface ProfileForm {
  first_name: string
  last_name: string
  phone: string
}

export default function AccountPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { user, isAuthenticated, isLoading: authLoading, loadUser } = useAuthStore()

  const [editingProfile, setEditingProfile] = useState(false)
  const [profileForm, setProfileForm] = useState<ProfileForm>({
    first_name: '',
    last_name: '',
    phone: '',
  })
  const [showAddAddress, setShowAddAddress] = useState(false)
  const [addressForm, setAddressForm] = useState({
    label: 'Home',
    full_name: '',
    phone: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    pincode: '',
    country: 'India',
    is_default: false,
  })

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login?next=/account')
    }
  }, [authLoading, isAuthenticated, router])

  useEffect(() => {
    if (user) {
      setProfileForm({
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        phone: user.phone || '',
      })
    }
  }, [user])

  // Addresses
  const { data: addressesData, isLoading: addressesLoading } = useQuery<{ results: Address[] }>({
    queryKey: ['addresses'],
    queryFn: () => api.get('/addresses/').then(res => res.data),
    enabled: isAuthenticated,
  })

  const addresses: Address[] = addressesData?.results ?? (Array.isArray(addressesData) ? (addressesData as Address[]) : [])

  // Update profile
  const updateProfileMutation = useMutation({
    mutationFn: (data: ProfileForm) => api.patch('/auth/me/', data),
    onSuccess: () => {
      toast.success('Profile updated successfully')
      loadUser()
      setEditingProfile(false)
    },
    onError: () => toast.error('Failed to update profile'),
  })

  // Add address
  const addAddressMutation = useMutation({
    mutationFn: (data: typeof addressForm) => api.post('/addresses/', data),
    onSuccess: () => {
      toast.success('Address added')
      queryClient.invalidateQueries({ queryKey: ['addresses'] })
      setShowAddAddress(false)
      setAddressForm({
        label: 'Home', full_name: '', phone: '', address_line1: '',
        address_line2: '', city: '', state: '', pincode: '', country: 'India', is_default: false,
      })
    },
    onError: () => toast.error('Failed to add address'),
  })

  // Delete address
  const deleteAddressMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/addresses/${id}/`),
    onSuccess: () => {
      toast.success('Address removed')
      queryClient.invalidateQueries({ queryKey: ['addresses'] })
    },
    onError: () => toast.error('Failed to remove address'),
  })

  if (authLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50/50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 transition-colors">
      <Navbar />

      <main className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-6">
          <Link href="/" className="hover:text-blue-600 dark:hover:text-blue-400">Home</Link>
          <span>/</span>
          <span className="text-gray-900 dark:text-gray-200 font-medium">My Account</span>
        </div>

        <h1 className="text-3xl font-extrabold text-gray-950 dark:text-white tracking-tight mb-8">
          My Account
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Sidebar — quick links */}
          <div className="space-y-3">
            <div className="card p-5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
                  <User size={22} className="text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="font-bold text-gray-900 dark:text-white text-sm">
                    {user?.first_name ? `${user.first_name} ${user.last_name}` : user?.email}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[160px]">{user?.email}</p>
                </div>
              </div>

              {user?.is_staff && (
                <div className="flex items-center gap-1.5 mb-3 px-2 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-xs font-semibold">
                  <Shield size={13} /> Admin / Staff
                </div>
              )}

              <nav className="space-y-1">
                {[
                  { href: '/account', label: 'Account Overview', icon: <User size={16} />, active: true },
                  { href: '/account/orders', label: 'My Orders', icon: <Package size={16} /> },
                  { href: '/cart', label: 'Shopping Cart', icon: <Package size={16} /> },
                  ...(user?.is_staff ? [{ href: '/admin', label: 'Admin Panel', icon: <Settings size={16} /> }] : []),
                ].map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      link.active
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                  >
                    {link.icon} {link.label}
                  </Link>
                ))}
              </nav>
            </div>
          </div>

          {/* Main content */}
          <div className="lg:col-span-2 space-y-6">

            {/* Profile card */}
            <div className="card p-6 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <User size={18} /> Profile Information
                </h2>
                {!editingProfile && (
                  <button
                    onClick={() => setEditingProfile(true)}
                    className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5"
                  >
                    <Edit3 size={13} /> Edit
                  </button>
                )}
              </div>

              {editingProfile ? (
                <form
                  onSubmit={(e) => { e.preventDefault(); updateProfileMutation.mutate(profileForm) }}
                  className="space-y-4"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">First Name</label>
                      <input
                        className="input-field"
                        value={profileForm.first_name}
                        onChange={e => setProfileForm(p => ({ ...p, first_name: e.target.value }))}
                        placeholder="First name"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Last Name</label>
                      <input
                        className="input-field"
                        value={profileForm.last_name}
                        onChange={e => setProfileForm(p => ({ ...p, last_name: e.target.value }))}
                        placeholder="Last name"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Phone Number</label>
                    <input
                      className="input-field"
                      value={profileForm.phone}
                      onChange={e => setProfileForm(p => ({ ...p, phone: e.target.value }))}
                      placeholder="10-digit mobile number"
                      type="tel"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                    <input className="input-field opacity-60 cursor-not-allowed" value={user?.email || ''} disabled />
                    <p className="text-xs text-gray-400 mt-1">Email address cannot be changed.</p>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      type="submit"
                      disabled={updateProfileMutation.isPending}
                      className="btn-primary text-sm py-2 px-4"
                    >
                      {updateProfileMutation.isPending ? 'Saving…' : 'Save Changes'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingProfile(false)}
                      className="btn-secondary text-sm py-2 px-4"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <InfoRow icon={<User size={15} />} label="Name" value={user?.first_name ? `${user.first_name} ${user.last_name}` : '—'} />
                  <InfoRow icon={<Mail size={15} />} label="Email" value={user?.email || '—'} />
                  <InfoRow icon={<Phone size={15} />} label="Phone" value={user?.phone || '—'} />
                  <InfoRow icon={<CheckCircle size={15} />} label="Account Status" value={user?.is_active ? 'Active' : 'Inactive'} />
                </div>
              )}
            </div>

            {/* Quick actions */}
            <div className="card p-6 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
                <Package size={18} /> Quick Actions
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Link
                  href="/account/orders"
                  className="flex items-center justify-between p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <Package size={20} className="text-blue-600 dark:text-blue-400" />
                    <div>
                      <p className="font-semibold text-sm text-gray-900 dark:text-white">Order History</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">View all your past orders</p>
                    </div>
                  </div>
                  <ArrowRight size={16} className="text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" />
                </Link>
                <Link
                  href="/products"
                  className="flex items-center justify-between p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-indigo-400 dark:hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/10 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <Package size={20} className="text-indigo-600 dark:text-indigo-400" />
                    <div>
                      <p className="font-semibold text-sm text-gray-900 dark:text-white">Browse Products</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Shop the full catalog</p>
                    </div>
                  </div>
                  <ArrowRight size={16} className="text-gray-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors" />
                </Link>
              </div>
            </div>

            {/* Saved Addresses */}
            <div className="card p-6 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <MapPin size={18} /> Saved Addresses
                </h2>
                <button
                  onClick={() => setShowAddAddress(!showAddAddress)}
                  className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5"
                >
                  <Plus size={13} /> Add Address
                </button>
              </div>

              {/* Add address form */}
              {showAddAddress && (
                <form
                  onSubmit={(e) => { e.preventDefault(); addAddressMutation.mutate(addressForm) }}
                  className="mb-5 p-4 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/10 space-y-3"
                >
                  <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">New Address</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input className="input-field text-sm" placeholder="Label (Home / Office)"
                      value={addressForm.label} onChange={e => setAddressForm(a => ({ ...a, label: e.target.value }))} />
                    <input className="input-field text-sm" placeholder="Full Name" required
                      value={addressForm.full_name} onChange={e => setAddressForm(a => ({ ...a, full_name: e.target.value }))} />
                    <input className="input-field text-sm" placeholder="Phone" required
                      value={addressForm.phone} onChange={e => setAddressForm(a => ({ ...a, phone: e.target.value }))} />
                    <input className="input-field text-sm" placeholder="Pincode" required
                      value={addressForm.pincode} onChange={e => setAddressForm(a => ({ ...a, pincode: e.target.value }))} />
                    <input className="input-field text-sm sm:col-span-2" placeholder="Address Line 1" required
                      value={addressForm.address_line1} onChange={e => setAddressForm(a => ({ ...a, address_line1: e.target.value }))} />
                    <input className="input-field text-sm sm:col-span-2" placeholder="Address Line 2 (optional)"
                      value={addressForm.address_line2} onChange={e => setAddressForm(a => ({ ...a, address_line2: e.target.value }))} />
                    <input className="input-field text-sm" placeholder="City" required
                      value={addressForm.city} onChange={e => setAddressForm(a => ({ ...a, city: e.target.value }))} />
                    <input className="input-field text-sm" placeholder="State" required
                      value={addressForm.state} onChange={e => setAddressForm(a => ({ ...a, state: e.target.value }))} />
                  </div>
                  <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                    <input type="checkbox" checked={addressForm.is_default}
                      onChange={e => setAddressForm(a => ({ ...a, is_default: e.target.checked }))} />
                    Set as default address
                  </label>
                  <div className="flex gap-2">
                    <button type="submit" disabled={addAddressMutation.isPending} className="btn-primary text-sm py-2 px-4">
                      {addAddressMutation.isPending ? 'Adding…' : 'Save Address'}
                    </button>
                    <button type="button" onClick={() => setShowAddAddress(false)} className="btn-secondary text-sm py-2 px-4">
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              {addressesLoading ? (
                <div className="space-y-3">
                  {[1, 2].map(i => <div key={i} className="h-20 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />)}
                </div>
              ) : addresses.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <MapPin size={32} className="mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No saved addresses yet.</p>
                  <p className="text-xs mt-1">Add an address to speed up checkout.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {addresses.map((addr) => (
                    <div
                      key={addr.id}
                      className="flex items-start justify-between p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50"
                    >
                      <div className="text-sm space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-900 dark:text-white">{addr.label}</span>
                          {addr.is_default && (
                            <span className="badge bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 text-xs">Default</span>
                          )}
                        </div>
                        <p className="text-gray-700 dark:text-gray-300">{addr.full_name} · {addr.phone}</p>
                        <p className="text-gray-500 dark:text-gray-400">
                          {addr.address_line1}{addr.address_line2 ? `, ${addr.address_line2}` : ''},
                          {' '}{addr.city}, {addr.state} — {addr.pincode}
                        </p>
                      </div>
                      <button
                        onClick={() => deleteAddressMutation.mutate(addr.id)}
                        className="ml-3 p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors shrink-0"
                        title="Remove address"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="text-gray-400 mt-0.5">{icon}</span>
      <div>
        <span className="text-xs text-gray-500 dark:text-gray-400 block">{label}</span>
        <span className="font-medium text-gray-900 dark:text-white text-sm">{value}</span>
      </div>
    </div>
  )
}
