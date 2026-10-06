import { useEffect, useState } from 'react'
import { adminFetch } from './adminApi.js'
import MemberRecord from '../components/MemberRecord.jsx'
import RecordSkeleton from '../components/RecordSkeleton.jsx'
import PaymentCoveragePreview from './PaymentCoveragePreview.jsx'
import EditMemberForm from './EditMemberForm.jsx'

function AdminMemberRecordStub({ memberId, onNavigate }) {
  const [member, setMember] = useState(null)
  const [memberDues, setMemberDues] = useState([])
  const [duesStartMonth, setDuesStartMonth] = useState(null)
  const [outstandingBalance, setOutstandingBalance] = useState(0)
  const [paymentAccounts, setPaymentAccounts] = useState([])
  const [openYear, setOpenYear] = useState(2026)
  const [loading, setLoading] = useState(true)
  const [paymentManagementOpen, setPaymentManagementOpen] = useState(false)
  const [editMemberOpen, setEditMemberOpen] = useState(false)
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false)
  const [archiveSaving, setArchiveSaving] = useState(false)
  const [recordVersion, setRecordVersion] = useState(0)
  const confirmArchiveMember = async () => {
    if (!member || archiveSaving) return

    const isArchived = member.membership_status === 'archived'
    const nextStatus = isArchived ? 'active' : 'archived'
    const actionLabel = isArchived ? 'restored' : 'moved to Archive'

    setArchiveSaving(true)

    try {
      const response = await adminFetch(`/api/admin/members/${member.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: nextStatus,
        }),
      })

      if (!response.ok) {
        throw new Error('Member status could not be updated')
      }

      sessionStorage.setItem(
        'adminMemberFeedback',
        isArchived
          ? `${member.full_name} has been restored successfully.`
          : `${member.full_name} has been moved to Archive successfully.`
      )

      setArchiveConfirmOpen(false)
      onNavigate(isArchived ? '/admin' : '/admin?status=archived')
    } catch (error) {
      console.error(`Member ${actionLabel} failed:`, error)
    } finally {
      setArchiveSaving(false)
    }
  }

  useEffect(() => {
    let cancelled = false

    Promise.all([
      adminFetch(`/api/members/${memberId}`).then((response) => {
        if (!response.ok) throw new Error('Member not found')
        return response.json()
      }),
      adminFetch(`/api/members/${memberId}/dues`).then((response) => {
        if (!response.ok) throw new Error('Member dues not found')
        return response.json()
      }),
      adminFetch(`/api/payment-accounts`).then((response) => {
        if (!response.ok) throw new Error('Payment accounts not found')
        return response.json()
      }),
    ])
      .then(([memberData, duesData, paymentAccountsData]) => {
        if (!cancelled) {
          setMember(memberData)
          setMemberDues(duesData.dues)
          setDuesStartMonth(duesData.regular_dues_start_month)
          setOutstandingBalance(duesData.outstanding_balance_ngn)
          setPaymentAccounts(paymentAccountsData)
        }
      })
      .catch((error) => {
        console.error('Admin member lookup failed:', error)
        if (!cancelled) {
          setMember(null)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [memberId, recordVersion])

  if (loading) return <RecordSkeleton />

  if (!member) {
    return <section className="admin-page"><p className="admin-stub-copy">Member record could not be loaded.</p></section>
  }

  return (
    <MemberRecord
      selectedMember={member}
      outstandingBalance={outstandingBalance}
      paymentAccounts={paymentAccounts}
      memberDues={memberDues}
      duesStartMonth={duesStartMonth}
      openYear={openYear}
      onOpenYearChange={setOpenYear}
      onBack={() => onNavigate('/admin')}
      backLabel="← Back to Members"
      eyebrow="MEMBER RECORD"
      headerAction={
        <div className="record-header-actions">
          <button
            className="record-edit-button"
            type="button"
            onClick={() => {
              setEditMemberOpen((isOpen) => !isOpen)
              setPaymentManagementOpen(false)
            }}
          >
            {editMemberOpen ? 'Hide Edit' : 'Edit Member'}
          </button>
          <button
            className="record-payment-button"
            type="button"
            onClick={() => {
              setPaymentManagementOpen((isOpen) => !isOpen)
              setEditMemberOpen(false)
            }}
          >
            {paymentManagementOpen ? 'Hide Payment' : 'Record Payment'}
          </button>
        </div>
      }
      beforeHistory={
        editMemberOpen ? (
          <EditMemberForm
            key={`${member.id}-${recordVersion}`}
            memberId={memberId}
            memberName={member.full_name}
            duesStartMonth={duesStartMonth}
            onSaved={() => setRecordVersion((version) => version + 1)}
          />
        ) : paymentManagementOpen ? (
          <PaymentCoveragePreview memberId={memberId} memberName={member.full_name} memberDues={memberDues} onSaved={() => setRecordVersion((version) => version + 1)} />
        ) : null
      }
footer={
      <>
        <section className="archive-member-section">
          <button
            type="button"
            className={
              member.membership_status === 'archived'
                ? 'archive-member-button restore-member-button'
                : 'archive-member-button'
            }
            onClick={() => setArchiveConfirmOpen(true)}
            disabled={archiveSaving}
          >
            {member.membership_status === 'archived'
              ? 'Restore Member'
              : 'Archive Member'}
          </button>
        </section>

        {archiveConfirmOpen && (
          <div
            className="payment-confirmation-backdrop"
            role="presentation"
            onClick={() => {
              if (!archiveSaving) setArchiveConfirmOpen(false)
            }}
          >
            <section
              className="payment-confirmation-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="archive-member-title"
              onClick={(event) => event.stopPropagation()}
            >
              <h3 id="archive-member-title">
                {member.membership_status === 'archived'
                  ? 'Restore member'
                  : 'Archive member'}
              </h3>

              <p>
                {member.membership_status === 'archived'
                  ? 'This member will be returned to the active member list.'
                  : 'When you archive a member, they will be removed from the active member list, but their payment history will be preserved.'}
              </p>

              <p className="archive-confirm-question">
                Are you sure you want to{' '}
                {member.membership_status === 'archived'
                  ? 'restore'
                  : 'archive'}{' '}
                <strong>{member.full_name}</strong>?
              </p>

              <div className="payment-confirmation-actions">
                <button
                  type="button"
                  className="cancel-button"
                  onClick={(event) => {
                    event.currentTarget.blur()
                    if (!archiveSaving) setArchiveConfirmOpen(false)
                  }}
                  disabled={archiveSaving}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className={
                    member.membership_status === 'archived'
                      ? 'record-payment-button'
                      : 'save-payment-button archive-confirm-button'
                  }
                  onClick={(event) => {
                    event.currentTarget.blur()
                    confirmArchiveMember()
                  }}
                  disabled={archiveSaving}
                >
                  {archiveSaving
                    ? 'Processing…'
                    : member.membership_status === 'archived'
                      ? 'Restore Member'
                      : 'Archive Member'}
                </button>
              </div>
            </section>
          </div>
        )}
      </>
    }
    />
  )
}

export default AdminMemberRecordStub
