'use client'
import { Printer } from 'lucide-react'
export const PrintButton = () => <button type="button" className="btn btn-sm h-9" onClick={() => window.print()}><Printer className="size-3.5" />Print</button>
