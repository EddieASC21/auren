import dynamic from 'next/dynamic'
import DesignLoading from './loading'

const DesignPageClient = dynamic(() => import('./DesignPageClient'), {
  ssr: false,
  loading: () => <DesignLoading />,
})

export default function DesignPage() {
  return <DesignPageClient />
}
