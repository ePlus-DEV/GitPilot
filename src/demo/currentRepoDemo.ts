import type { CommitInfo, GitStatus, RepositoryInfo } from '../types/git';

export const demoRepo: RepositoryInfo = {
  "name": "GitPilot",
  "path": "/workspace/GitPilot",
  "currentBranch": "work"
};

export const demoHistory: CommitInfo[] = [
  {
    "hash": "23c0500400ad2fdcfc353fc2759f4b53914b5c46",
    "shortHash": "23c0500",
    "parents": [
      "0b45c4af87657035ba2378f2c28b6d1b9e049609",
      "08f0633368c98f75d2074eb502d03bce9fda70f4"
    ],
    "author": "David Nguyen",
    "date": "2026-06-26",
    "refs": [
      "HEAD -> work"
    ],
    "message": "Merge pull request #8 from ePlus-DEV/codex/fix-missing-icon-file-error-kb9qnb",
    "head": true,
    "insertions": 0,
    "deletions": 0,
    "graph": ""
  },
  {
    "hash": "08f0633368c98f75d2074eb502d03bce9fda70f4",
    "shortHash": "08f0633",
    "parents": [
      "e3bce538cc3966894d182740f4e8b505d1986b7d"
    ],
    "author": "David Nguyen",
    "date": "2026-06-26",
    "refs": [],
    "message": "Reduce headless app warning noise",
    "head": false,
    "insertions": 0,
    "deletions": 0,
    "graph": ""
  },
  {
    "hash": "e3bce538cc3966894d182740f4e8b505d1986b7d",
    "shortHash": "e3bce53",
    "parents": [
      "0b45c4af87657035ba2378f2c28b6d1b9e049609"
    ],
    "author": "David Nguyen",
    "date": "2026-06-26",
    "refs": [],
    "message": "Publish screenshot for inline PR preview",
    "head": false,
    "insertions": 0,
    "deletions": 0,
    "graph": ""
  },
  {
    "hash": "0b45c4af87657035ba2378f2c28b6d1b9e049609",
    "shortHash": "0b45c4a",
    "parents": [
      "ec964c6827a08a856131e9051f8b183ca065f215",
      "f494a9f18b43a76d9c2ae67ebde4c4cdc0115fa8"
    ],
    "author": "David Nguyen",
    "date": "2026-06-26",
    "refs": [],
    "message": "Merge pull request #5 from ePlus-DEV/codex/bo-sung-github-action-va-template",
    "head": false,
    "insertions": 0,
    "deletions": 0,
    "graph": ""
  },
  {
    "hash": "f494a9f18b43a76d9c2ae67ebde4c4cdc0115fa8",
    "shortHash": "f494a9f",
    "parents": [
      "746178e746328c9dd70fa0e97d78227bfd7f038a",
      "19df9c1a406da8b6b3e5f3e6dbccfde1368d1594"
    ],
    "author": "David Nguyen",
    "date": "2026-06-26",
    "refs": [],
    "message": "Merge pull request #6 from ePlus-DEV/codex/sua-loi-github-action",
    "head": false,
    "insertions": 0,
    "deletions": 0,
    "graph": ""
  },
  {
    "hash": "19df9c1a406da8b6b3e5f3e6dbccfde1368d1594",
    "shortHash": "19df9c1",
    "parents": [
      "746178e746328c9dd70fa0e97d78227bfd7f038a"
    ],
    "author": "David Nguyen",
    "date": "2026-06-26",
    "refs": [],
    "message": "Fix CI dependency lock usage",
    "head": false,
    "insertions": 0,
    "deletions": 0,
    "graph": ""
  },
  {
    "hash": "746178e746328c9dd70fa0e97d78227bfd7f038a",
    "shortHash": "746178e",
    "parents": [
      "a903a03e3f68baa320dfed521fde3d6181b054b4"
    ],
    "author": "David Nguyen",
    "date": "2026-06-26",
    "refs": [],
    "message": "feat: enhance UI components and improve functionality",
    "head": false,
    "insertions": 0,
    "deletions": 0,
    "graph": ""
  },
  {
    "hash": "a903a03e3f68baa320dfed521fde3d6181b054b4",
    "shortHash": "a903a03",
    "parents": [
      "0142632ca27e48a64d2053a1597a93c9ef2bcdf6"
    ],
    "author": "David Nguyen",
    "date": "2026-06-26",
    "refs": [],
    "message": "Remove --locked flag from cargo check command in CI workflow",
    "head": false,
    "insertions": 0,
    "deletions": 0,
    "graph": ""
  },
  {
    "hash": "0142632ca27e48a64d2053a1597a93c9ef2bcdf6",
    "shortHash": "0142632",
    "parents": [
      "e7166bfb97ff895130623089792176e92115a09a"
    ],
    "author": "David Nguyen",
    "date": "2026-06-26",
    "refs": [],
    "message": "fix(ci): remove --locked flag from cargo check",
    "head": false,
    "insertions": 0,
    "deletions": 0,
    "graph": ""
  },
  {
    "hash": "e7166bfb97ff895130623089792176e92115a09a",
    "shortHash": "e7166bf",
    "parents": [
      "ec964c6827a08a856131e9051f8b183ca065f215"
    ],
    "author": "David Nguyen",
    "date": "2026-06-25",
    "refs": [],
    "message": "Add GitHub workflow and contribution templates",
    "head": false,
    "insertions": 0,
    "deletions": 0,
    "graph": ""
  },
  {
    "hash": "ec964c6827a08a856131e9051f8b183ca065f215",
    "shortHash": "ec964c6",
    "parents": [
      "bc9686e297e76fcbda321c4792b72cffdecc5cb6",
      "bea3e014f6ca91eff3bb9db174488bdb1acef4ed"
    ],
    "author": "David Nguyen",
    "date": "2026-06-25",
    "refs": [],
    "message": "Merge pull request #2 from ePlus-DEV/codex/create-gitpilot-desktop-client-mvp",
    "head": false,
    "insertions": 0,
    "deletions": 0,
    "graph": ""
  },
  {
    "hash": "bea3e014f6ca91eff3bb9db174488bdb1acef4ed",
    "shortHash": "bea3e01",
    "parents": [
      "bc9686e297e76fcbda321c4792b72cffdecc5cb6"
    ],
    "author": "David Nguyen",
    "date": "2026-06-25",
    "refs": [],
    "message": "Expand GitPilot into full desktop Git client",
    "head": false,
    "insertions": 0,
    "deletions": 0,
    "graph": ""
  },
  {
    "hash": "bc9686e297e76fcbda321c4792b72cffdecc5cb6",
    "shortHash": "bc9686e",
    "parents": [
      "ba77da2a712322b58dd60262752b94839279f3cf",
      "e722ae4c41f2ad3e54649ef658a9efb1e27d9c82"
    ],
    "author": "David Nguyen",
    "date": "2026-06-25",
    "refs": [],
    "message": "Merge pull request #1 from ePlus-DEV/codex/design-logo-for-gitpilot-git-client",
    "head": false,
    "insertions": 0,
    "deletions": 0,
    "graph": ""
  },
  {
    "hash": "e722ae4c41f2ad3e54649ef658a9efb1e27d9c82",
    "shortHash": "e722ae4",
    "parents": [
      "ba77da2a712322b58dd60262752b94839279f3cf"
    ],
    "author": "David Nguyen",
    "date": "2026-06-25",
    "refs": [],
    "message": "Add GitPilot source scaffold",
    "head": false,
    "insertions": 0,
    "deletions": 0,
    "graph": ""
  },
  {
    "hash": "ba77da2a712322b58dd60262752b94839279f3cf",
    "shortHash": "ba77da2",
    "parents": [],
    "author": "David Nguyen",
    "date": "2026-06-24",
    "refs": [],
    "message": "Initialize repository",
    "head": false,
    "insertions": 0,
    "deletions": 0,
    "graph": ""
  }
];

export const demoStatus: GitStatus = {
  "currentBranch": "work",
  "staged": [],
  "unstaged": [],
  "untracked": [],
  "conflicted": [],
  "ahead": 0,
  "behind": 0,
  "mergeState": {
    "isMerging": false,
    "isRebasing": false,
    "conflictedFiles": []
  }
};

