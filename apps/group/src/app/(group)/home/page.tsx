'use client';

import { RequireAuth } from '@/components/auth/RequireAuth';
import { DepartmentSolarSystem } from '@/components/hub/DepartmentSolarSystem';
import { HOME_PATH } from '@/lib/postLoginPath';

/**
 * Post-auth landing. The only content is the department solar system.
 *
 * `learnerFlow` sends guests into the phone OTP flow and users whose profile is
 * still incomplete back to it, so this page only ever renders for a
 * fully registered learner.
 */
export default function HomeGatePage() {
  return (
    <RequireAuth nextPath={HOME_PATH} learnerFlow>
      <div className="page-content home-gate">
        <div className="container hub">
          <DepartmentSolarSystem />
        </div>
      </div>
    </RequireAuth>
  );
}