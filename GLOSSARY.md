# feedback.nearbuilders.org

Feedback rounds for builders on NEAR: organizations open rounds, testers join and submit feedback, and builders earn credits. Part of a family of apps (nearbuilders.org, activity.nearbuilders.org) that share one identity model.

## Language

### Organizations & access

**Owner organization**:
The single organization a project belongs to (`projects.ownerOrgId`). It decides who may manage the project's rounds; its members are managers unless it delegates to a managing team. Ownership never transfers between orgs.
_Avoid_: project owner (that reads as a person), creator (the round's `ownerAccountId`, which is attribution, not permission)

**Access grant**:
A row in `access_grants`: a principal (organization or team) holding a permission (`manage` or `read`) on a project. The mechanism behind co-management; v1 writes only org principals with `manage`. The access decision consumes grants as data attached to the project — the source of the rows is a loader detail.
_Avoid_: permission (alone — always say which principal holds it), ACL, role

**Partner**:
The product name for an organization holding a `manage` access grant on a project, displayed as "Partners" in the UI and API. Partners co-manage every round of the project alongside the owner organization, including private feedback; they cannot manage the partnership itself or the managing team, and they cannot create rounds under someone else's project.
_Avoid_: collaborator (that's nearbuilders.org's per-person concept), co-owner, viewer (a partner manages; a future `read` grant will be the viewer case)

**Managing team**:
A team of the owner organization that the org delegated the project to, replacing "any org member" (null means everyone). Team delegation constrains only the owner organization — partners and org API keys are unaffected by it.
_Avoid_: team (alone — teams also exist org-wide in the auth plugin for authoring gates)
